#!/usr/bin/env -S deno run --allow-net=localhost,127.0.0.1 --allow-write=backups/graylog

type JsonRecord = Record<string, unknown>;

type BackupOptions = {
  opensearchUrl: string;
  indexPattern: string;
  outputRoot: string;
  batchSize: number;
};

type SearchHit = {
  _index: string;
  _id: string;
  _score?: number | null;
  _source: JsonRecord;
};

type SearchResponse = {
  _scroll_id?: string;
  hits?: {
    hits?: SearchHit[];
  };
};

function parseArgs(args: string[]): BackupOptions {
  const options: BackupOptions = {
    opensearchUrl: "http://localhost:9200",
    indexPattern: "graylog_*",
    outputRoot: "backups/graylog",
    batchSize: 500,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--opensearch-url" && next) {
      options.opensearchUrl = next;
      i += 1;
    } else if (arg === "--index" && next) {
      options.indexPattern = next;
      i += 1;
    } else if (arg === "--out" && next) {
      options.outputRoot = next;
      i += 1;
    } else if (arg === "--batch-size" && next) {
      options.batchSize = Number(next);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      Deno.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.batchSize) || options.batchSize < 1) {
    throw new Error("--batch-size must be a positive integer");
  }

  options.opensearchUrl = options.opensearchUrl.replace(/\/+$/, "");
  return options;
}

function printHelp(): void {
  console.log(`Backup Graylog messages from the local OpenSearch store.

Usage:
  deno run --allow-net=localhost,127.0.0.1 --allow-write=backups/graylog scripts/backup-graylog.ts

Options:
  --opensearch-url URL  OpenSearch base URL. Default: http://localhost:9200
  --index PATTERN      Index pattern to export. Default: graylog_*
  --out DIR            Backup root directory. Default: backups/graylog
  --batch-size N       Scroll page size. Default: 500
`);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `GET ${url} failed: ${response.status} ${await response.text()}`,
    );
  }
  return await response.json() as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `POST ${url} failed: ${response.status} ${await response.text()}`,
    );
  }
  return await response.json() as T;
}

function backupId(date: Date): string {
  return date.toISOString().replaceAll(":", "").replaceAll(".", "").replace(
    "Z",
    "Z",
  );
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await Deno.writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function appendLine(file: Deno.FsFile, value: unknown): Promise<void> {
  const line = `${JSON.stringify(value)}\n`;
  await file.write(new TextEncoder().encode(line));
}

async function exportMessages(
  options: BackupOptions,
  backupDir: string,
): Promise<{ exported: number; scrollId?: string }> {
  const rawFile = await Deno.open(`${backupDir}/messages.ndjson`, {
    create: true,
    write: true,
    truncate: true,
  });
  const bulkFile = await Deno.open(`${backupDir}/messages.bulk.ndjson`, {
    create: true,
    write: true,
    truncate: true,
  });

  let exported = 0;
  let scrollId: string | undefined;

  try {
    const first = await postJson<SearchResponse>(
      `${options.opensearchUrl}/${
        encodeURIComponent(options.indexPattern)
      }/_search?scroll=2m`,
      {
        size: options.batchSize,
        sort: ["_doc"],
        query: { match_all: {} },
      },
    );
    scrollId = first._scroll_id;
    let hits = first.hits?.hits ?? [];

    while (hits.length > 0) {
      for (const hit of hits) {
        await appendLine(rawFile, hit);
        await appendLine(bulkFile, {
          index: { _index: hit._index, _id: hit._id },
        });
        await appendLine(bulkFile, hit._source);
        exported += 1;
      }

      if (!scrollId) {
        break;
      }

      const next = await postJson<SearchResponse>(
        `${options.opensearchUrl}/_search/scroll`,
        { scroll: "2m", scroll_id: scrollId },
      );
      scrollId = next._scroll_id ?? scrollId;
      hits = next.hits?.hits ?? [];
    }
  } finally {
    rawFile.close();
    bulkFile.close();
  }

  if (scrollId) {
    await fetch(`${options.opensearchUrl}/_search/scroll`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scroll_id: [scrollId] }),
    }).catch(() => undefined);
  }

  return { exported, scrollId };
}

async function main(): Promise<void> {
  const options = parseArgs(Deno.args);
  const createdAt = new Date();
  const id = backupId(createdAt);
  const backupDir = `${options.outputRoot.replace(/\/+$/, "")}/${id}`;

  await Deno.mkdir(backupDir, { recursive: true });

  const [
    health,
    indices,
    count,
    mappings,
    settings,
    aliases,
  ] = await Promise.all([
    getJson<JsonRecord>(`${options.opensearchUrl}/_cluster/health`),
    getJson<JsonRecord[]>(
      `${options.opensearchUrl}/_cat/indices/${
        encodeURIComponent(options.indexPattern)
      }?format=json&bytes=b&s=index`,
    ),
    getJson<JsonRecord>(
      `${options.opensearchUrl}/${
        encodeURIComponent(options.indexPattern)
      }/_count`,
    ),
    getJson<JsonRecord>(
      `${options.opensearchUrl}/${
        encodeURIComponent(options.indexPattern)
      }/_mapping`,
    ),
    getJson<JsonRecord>(
      `${options.opensearchUrl}/${
        encodeURIComponent(options.indexPattern)
      }/_settings`,
    ),
    getJson<JsonRecord>(
      `${options.opensearchUrl}/${
        encodeURIComponent(options.indexPattern)
      }/_alias`,
    ),
  ]);

  await writeJson(`${backupDir}/cluster-health.json`, health);
  await writeJson(`${backupDir}/indices.json`, indices);
  await writeJson(`${backupDir}/count.json`, count);
  await writeJson(`${backupDir}/mappings.json`, mappings);
  await writeJson(`${backupDir}/settings.json`, settings);
  await writeJson(`${backupDir}/aliases.json`, aliases);

  const { exported } = await exportMessages(options, backupDir);

  const manifest = {
    backup_id: id,
    created_at: createdAt.toISOString(),
    source: {
      opensearch_url: options.opensearchUrl,
      index_pattern: options.indexPattern,
    },
    files: {
      messages_ndjson: "messages.ndjson",
      messages_bulk_ndjson: "messages.bulk.ndjson",
      cluster_health: "cluster-health.json",
      indices: "indices.json",
      count: "count.json",
      mappings: "mappings.json",
      settings: "settings.json",
      aliases: "aliases.json",
    },
    expected_count: count.count ?? null,
    exported_count: exported,
    restore_hint:
      "messages.bulk.ndjson is OpenSearch bulk format. Recreate mappings/settings first if restoring into a fresh index.",
  };

  await writeJson(`${backupDir}/manifest.json`, manifest);

  console.log(`Graylog backup written to ${backupDir}`);
  console.log(`Exported ${exported} messages from ${options.indexPattern}`);
}

if (import.meta.main) {
  await main();
}
