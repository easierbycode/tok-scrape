// Mock data for the Free Sample Haul modal (extension-seller/samples-modal).
//
// This dataset does NOT exist in the scrapers yet — it stands in for a
// soon-to-be-collected feed that corroborates $0 (free-sample) orders against
// their original retail value. It powers the membership-club pitch: "replace
// your household expenses with free TikTok Shop samples."
//
// The headline figures mirror the demo story exactly:
//   ~1,500 samples ≈ $75,000 retail across two accounts in one week ($50 avg),
//   $5,000/mo is maintainable without a warehouse, and reselling at just 10%
//   of retail = $7,500/wk.
//
// `samples[]` is a representative slice of real-ish household staples (the table
// shows "48 of 1,500"); `byCategory`/`showcase`/`accounts`/`totals` carry the
// full weekly story. Exposed as a global so the page (or a future content-script
// injection) can hand it straight to TOK_SAMPLES_MODAL.show().
(function () {
  'use strict';

  var EMOJI = {
    'Toiletries': '🪥',
    'Groceries': '🛒',
    'Cleaning': '🧴',
    'Paper Goods': '🧻',
    'Health & Beauty': '💄',
    'Home & Kitchen': '🍳'
  };

  var ACCOUNTS = ['@freebie_factory', '@sample_squad'];

  // [ product, brand, category, retailValue ] — recent-sample examples.
  var CATALOG = [
    ['Crest 3D White Toothpaste (3-pack)', 'Crest', 'Toiletries', 14.97],
    ['Oral-B Pro 1000 Electric Toothbrush', 'Oral-B', 'Toiletries', 49.99],
    ['Dove Body Wash (2-pack)', 'Dove', 'Toiletries', 13.49],
    ['Old Spice Deodorant (4-pack)', 'Old Spice', 'Toiletries', 19.96],
    ['Listerine Cool Mint 1.5L', 'Listerine', 'Toiletries', 8.97],
    ['Head & Shoulders Shampoo (2-pack)', 'Head & Shoulders', 'Toiletries', 17.98],
    ['Gillette Fusion5 Razor + 8 Cartridges', 'Gillette', 'Toiletries', 32.99],
    ['Native Deodorant (3-pack)', 'Native', 'Toiletries', 26.97],
    ['Colgate Optic White (4-pack)', 'Colgate', 'Toiletries', 18.96],
    ['Q-tips 625ct + Cotton Rounds', 'Q-tips', 'Toiletries', 7.49],

    ['Starbucks Ground Coffee (3-pack)', 'Starbucks', 'Groceries', 29.97],
    ['Quaker Old Fashioned Oats 5lb', 'Quaker', 'Groceries', 8.49],
    ['KIND Protein Bars (24ct)', 'KIND', 'Groceries', 19.99],
    ['OLIPOP Variety (12-pack)', 'OLIPOP', 'Groceries', 23.99],
    ["Rao's Marinara Sauce (3-pack)", "Rao's", 'Groceries', 26.97],
    ['Liquid Death Sparkling (12-pack)', 'Liquid Death', 'Groceries', 14.99],
    ['CELSIUS Energy Variety (12-pack)', 'CELSIUS', 'Groceries', 24.99],
    ['Ghirardelli Chocolate Bundle', 'Ghirardelli', 'Groceries', 21.50],
    ["Nature's Bakery Fig Bars (24ct)", "Nature's Bakery", 'Groceries', 12.99],

    ['Hefty Ultra Strong Trash Bags (90ct)', 'Hefty', 'Cleaning', 18.49],
    ['Tide PODS (81ct)', 'Tide', 'Cleaning', 24.99],
    ['Dawn Ultra Dish Soap (4-pack)', 'Dawn', 'Cleaning', 14.49],
    ['Clorox Disinfecting Wipes (5-pack)', 'Clorox', 'Cleaning', 17.99],
    ['Swiffer WetJet Starter Kit', 'Swiffer', 'Cleaning', 27.99],
    ['Lysol Disinfectant Spray (3-pack)', 'Lysol', 'Cleaning', 15.49],
    ['Glad Storage Bags (200ct)', 'Glad', 'Cleaning', 12.99],
    ["Mrs. Meyer's Multi-Surface (3-pack)", "Mrs. Meyer's", 'Cleaning', 13.50],
    ['Method Hand Wash (6-pack)', 'Method', 'Cleaning', 23.94],
    ['Febreze Air Effects (4-pack)', 'Febreze', 'Cleaning', 16.49],

    ['Charmin Ultra Soft (24 Mega Rolls)', 'Charmin', 'Paper Goods', 28.99],
    ['Bounty Select-A-Size (12-pack)', 'Bounty', 'Paper Goods', 31.49],
    ['Kleenex Ultra Soft (12 boxes)', 'Kleenex', 'Paper Goods', 18.99],
    ['Scott Paper Napkins (600ct)', 'Scott', 'Paper Goods', 9.99],
    ['Reynolds Wrap Foil (3-pack)', 'Reynolds', 'Paper Goods', 13.99],
    ['Pampers Sensitive Wipes (9-pack)', 'Pampers', 'Paper Goods', 19.99],

    ['CeraVe Moisturizing Bundle', 'CeraVe', 'Health & Beauty', 38.99],
    ['The Ordinary Serum Set', 'The Ordinary', 'Health & Beauty', 44.00],
    ['Nature Made Vitamin C + D3 (90-day)', 'Nature Made', 'Health & Beauty', 27.99],
    ['Maybelline Sky High Mascara (3-pack)', 'Maybelline', 'Health & Beauty', 23.97],
    ['e.l.f. Skincare Starter Kit', 'e.l.f.', 'Health & Beauty', 32.00],
    ['Olaplex No.3 Hair Treatment', 'Olaplex', 'Health & Beauty', 30.00],
    ['Mielle Rosemary Mint Oil Set', 'Mielle', 'Health & Beauty', 29.99],
    ['Cetaphil Gentle Cleanser 20oz', 'Cetaphil', 'Health & Beauty', 17.49],

    ['Ninja AF101 Air Fryer 4qt', 'Ninja', 'Home & Kitchen', 89.99],
    ['Stanley Quencher H2.0 40oz', 'Stanley', 'Home & Kitchen', 45.00],
    ['Lodge 10.25" Cast Iron Skillet', 'Lodge', 'Home & Kitchen', 24.99],
    ['Rubbermaid Brilliance (10-pack)', 'Rubbermaid', 'Home & Kitchen', 39.99],
    ['Energizer MAX AA (48ct)', 'Energizer', 'Home & Kitchen', 22.99]
  ];

  // Deterministic decoration — spread examples across the week and both accounts
  // without Math.random, so demo screenshots are stable.
  var samples = CATALOG.map(function (row, i) {
    var day = (i % 7) + 1; // Jun 1..7
    return {
      orderId: 'TT' + (4480000000 + i * 137413),
      orderedAt: '2026-06-0' + day,
      account: ACCOUNTS[i % 2],
      product: row[0],
      brand: row[1],
      category: row[2],
      retailValue: row[3],
      pricePaid: 0
    };
  });

  // Full-week breakdown — counts sum to 1,500, values sum to $75,000.
  var byCategory = [
    { category: 'Toiletries', emoji: EMOJI['Toiletries'], count: 380, retailValue: 19000 },
    { category: 'Groceries', emoji: EMOJI['Groceries'], count: 350, retailValue: 16900 },
    { category: 'Cleaning', emoji: EMOJI['Cleaning'], count: 300, retailValue: 14500 },
    { category: 'Paper Goods', emoji: EMOJI['Paper Goods'], count: 240, retailValue: 9600 },
    { category: 'Health & Beauty', emoji: EMOJI['Health & Beauty'], count: 150, retailValue: 9500 },
    { category: 'Home & Kitchen', emoji: EMOJI['Home & Kitchen'], count: 80, retailValue: 5500 }
  ];

  // Price Is Right "showcase" lots — revealed one at a time, the running total
  // climbing to the ACTUAL RETAIL VALUE. Derived from byCategory so it lands on
  // the true weekly figure ($75,000).
  var showcase = [
    { emoji: '🪥', name: 'The Bathroom Cabinet', blurb: 'A year of toothpaste, floss, body wash & deodorant', count: 380, retailValue: 19000 },
    { emoji: '🛒', name: 'The Grocery Run', blurb: 'Coffee, snacks, sauces & pantry staples', count: 350, retailValue: 16900 },
    { emoji: '🧴', name: 'The Cleaning Closet', blurb: 'Laundry pods, dish soap, sprays & trash bags', count: 300, retailValue: 14500 },
    { emoji: '🧻', name: 'The Paper Aisle', blurb: 'Toilet paper, paper towels & napkins for months', count: 240, retailValue: 9600 },
    { emoji: '💄', name: 'The Beauty Counter', blurb: 'Skincare, makeup & haircare', count: 150, retailValue: 9500 },
    { emoji: '🍳', name: 'The Kitchen Upgrade', blurb: 'Air fryer, cookware & small gadgets', count: 80, retailValue: 5500 }
  ];

  window.TOK_SAMPLES_MOCK = {
    isMock: true,
    period: { label: 'This week', start: '2026-06-01', end: '2026-06-07' },
    generatedAt: '2026-06-07T12:00:00Z',
    accounts: [
      { handle: '@freebie_factory', count: 820, retailValue: 41200 },
      { handle: '@sample_squad', count: 680, retailValue: 33800 }
    ],
    totals: {
      count: 1500,
      retailValue: 75000,
      pricePaid: 0,
      avgValue: 50,
      resaleRate: 0.10,
      resaleValue: 7500,
      monthlyMaintainable: 5000
    },
    byCategory: byCategory,
    showcase: showcase,
    samples: samples
  };
})();
