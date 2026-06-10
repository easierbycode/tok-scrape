const assert = require('assert');

// Simple mock of the function from index.js for testing
function firstPriceFromHtml(html) {
    if (!html) return null;
    const embedded = [
        /"sale_price"\s*:\s*\{[^}]*?"price_val"\s*:\s*"?\$?([0-9]+(?:\.[0-9]{1,2})?)/i,
        /"format(?:ed)?_price"\s*:\s*"?\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
        /"real_price"\s*:\s*"?\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
        /"price(?:_str)?"\s*:\s*"\$?\s*([0-9]+(?:\.[0-9]{1,2})?)"/i
    ];
    for (const re of embedded) {
        const m = html.match(re);
        if (m) {
            const n = parseFloat(m[1]);
            if (!isNaN(n) && n >= 0.5 && n <= 9999) return { price: n, tier: 'embedded' };
        }
    }
    const re = /\$\s?([0-9]{1,4}\.[0-9]{2})\b/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const n = parseFloat(m[1]);
        if (!isNaN(n) && n >= 3 && n <= 9999) return { price: n, tier: 'visible' };
    }
    return null;
}

// Tests
try {
    // Test embedded price
    const html1 = '{"sale_price": {"price_val": "19.99"}}';
    const res1 = firstPriceFromHtml(html1);
    assert.strictEqual(res1.price, 19.99);
    assert.strictEqual(res1.tier, 'embedded');

    // Test visible price
    const html2 = '<div>The price is $24.50</div>';
    const res2 = firstPriceFromHtml(html2);
    assert.strictEqual(res2.price, 24.50);
    assert.strictEqual(res2.tier, 'visible');

    // Test no price
    const html3 = '<div>No price here</div>';
    const res3 = firstPriceFromHtml(html3);
    assert.strictEqual(res3, null);

    console.log('All tests passed!');
} catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
}
