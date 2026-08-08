/**
 * The guide, in English and Urdu.
 *
 * Content as DATA rather than two pages of markup. The guide is the one screen
 * that exists to be read start to finish, so the two languages have to say the
 * same things in the same order - if they were two hand-written pages they
 * would drift the first time one of them was corrected. The page renders this
 * shape once and picks a language; adding a third would be adding a key.
 *
 * Everything here is written for someone who has never opened the app and has
 * run this pump on paper for years. So: what to do, in the order you do it,
 * naming the real buttons - not what the software is called or how it works.
 *
 * Kept in step with README.md, which is the ground truth for the routine and
 * for the rules the database enforces.
 */

export const LANGUAGES = ['en', 'ur'];

export const GUIDE = {
  en: {
    dir: 'ltr',
    switchLabel: 'اردو میں پڑھیں',
    switchAria: 'Read this guide in Urdu',
    title: 'How to use this app',
    intro:
      'This app replaces the register the pump has always been kept in. It does the same job in the same order — you read the meters at the end of the day, write down who took fuel on credit, and count the cash. The app adds up, remembers every balance, and will not let a day be saved unless it balances.',

    labels: {
      tip: 'Note:',
      important: 'Do not skip this. It is the check that catches almost every mistake.',
      onThisPage: 'On this page',
    },

    stages: [
      {
        when: 'Once, at the start',
        title: 'Set the pump up',
        body: 'Tanks, nozzles, prices, staff, customers. The owner does this, and only once.',
      },
      {
        when: 'Every evening',
        title: 'Enter the day',
        body: 'Meter readings, credit slips, count the cash. Ten minutes, and the books are done.',
      },
      {
        when: 'Once a month',
        title: 'Read the report',
        body: 'Sales, profit, what is owed. Download the sheet for the accountant.',
      },
    ],

    startHere: {
      heading: 'Where to begin',
      body: 'If the pump has already been set up, skip to “Every evening” below — that is the part done daily. The steps here are done once, by the owner, before anyone enters a first reading.',
    },

    setup: {
      heading: 'One-time setup, in this order',
      note: 'Each step needs the one above it, so keep to the order.',
      steps: [
        {
          title: 'Tanks',
          body: 'Settings → Tanks. Add each tank, its fuel, how many litres it holds, and how much is in it today. That figure is the starting point every stock calculation counts from.',
        },
        {
          title: 'Nozzles',
          body: 'Settings → Nozzle settings. Add every nozzle and say which tank it draws from. Get this right — a nozzle wired to the wrong tank takes fuel out of the wrong stock.',
        },
        {
          title: "Today's prices",
          body: 'Settings → Fuel prices. Set a rate for petrol and for diesel. Readings cannot be entered for a day that has no price, so this comes before anything else is typed.',
        },
        {
          title: 'Staff logins',
          body: 'Account → Staff. Give each person who will enter readings their own login. They can enter the day but cannot see profit, expenses, the bank, or change prices.',
        },
        {
          title: 'Credit customers',
          body: 'Customers → Add customer. Anyone who takes fuel on credit needs to be here before their first slip can be recorded. A credit limit is optional.',
        },
        {
          title: 'Lubricants',
          body: 'Lubricants → Manage lubricants. Add each brand the pump stocks, the pack size, and how many litres are on the shelf today. Only needed if oil is sold.',
        },
        {
          title: 'Loose oil, if a drum is kept',
          body: 'Same screen, but choose “Loose oil” as the kind instead of “Sealed packs”. Give it a name and — this one is required — the rate you sell it at per litre. That rate is what turns “Rs 20 of oil” into litres off the drum, so keep it up to date whenever the price changes.',
        },
      ],
    },

    daily: {
      heading: 'Every evening',
      note: 'This is the whole job. Ten minutes, once a day.',
      steps: [
        {
          title: 'Open Readings',
          body: 'The date at the top is today. Every nozzle is listed, and each one already shows the reading it closed at yesterday — you never type an opening figure.',
        },
        {
          title: 'Take one nozzle at a time',
          body: 'Tap a nozzle. Type the closing meter reading. The litres sold and what they are worth appear as you type, so a wrong digit is obvious straight away.',
        },
        {
          title: 'Enter the credit slips',
          body: 'For each paper slip on that nozzle, press + Add customer, choose the customer and type the litres. The amount fills in at today’s rate. Do this for every slip before moving on.',
          tip: 'A customer who is not in the list has to be added under Customers first.',
        },
        {
          title: 'Check the cash against the drawer',
          body: 'The app works out cash as whatever is left after the credit slips. Count the notes and compare before you save. If the two do not match, something is wrong while it is still easy to find.',
          warn: true,
        },
        {
          title: 'Save the nozzle',
          body: 'Each nozzle is saved on its own, so a mistake on one never blocks the other five. Every customer’s balance updates by itself. Repeat until every nozzle says Entered.',
        },
        {
          title: 'Oil sold over the counter',
          body: 'Lubricants → Record a sale, as each tin is sold rather than at the end. Pick the product, tap the pack size or type the litres, and say whether it was cash or credit. Credit lands on the same customer account as fuel.',
        },
        {
          title: 'Loose oil, sold by the rupee',
          body: 'Lubricants → Loose oil, its own page. Here you type what the customer PAID — tap Rs 20, Rs 30, Rs 50, or write any amount — and the app works out how much oil that is and takes it off the drum. You never measure the pour. The Lubricants page shows the day’s loose total with a link across, so it is easy to see whether both halves are in.',
          tip: 'If the drum on the ground empties faster or slower than the app says, the selling rate is the thing to check — the litres are worked out from it.',
        },
      ],
    },

    occasional: {
      heading: 'The rest, as it happens',
      items: [
        {
          icon: 'purchases',
          name: 'Purchases',
          when: 'The day a tanker or an oil delivery arrives. Enter the litres and the total on the delivery note — the rate per litre is worked out for you. Mark it paid or leave it pending.',
        },
        {
          icon: 'stock',
          name: 'Stock',
          when: 'When the tanks are dipped. Type the dip and the app shows the gain or loss against what the books expected. Also shows what is left on the lubricant shelf.',
        },
        {
          icon: 'customers',
          name: 'Customers',
          when: 'When someone pays off their account. Open the customer, record the payment, and their balance comes down. Their full history is on the same screen. A name added by mistake can be taken off with Remove — the owner only, and only once the account is settled.',
        },
        {
          icon: 'banking',
          name: 'Banking',
          when: 'Owner only. Money moved in or out of the pump’s bank accounts, and paying suppliers from them.',
        },
        {
          icon: 'expenses',
          name: 'Expenses',
          when: 'Owner only. Anything paid out — wages, electricity, repairs — the day it is paid. These come off the month’s profit.',
        },
        {
          icon: 'reports',
          name: 'Reports',
          when: 'Owner only. Once a month. Sales, profit, what is owed and what is owing, with a spreadsheet to download for the accountant.',
        },
      ],
    },

    rules: {
      heading: 'When the app refuses to save',
      note: 'These rules live in the database itself, so nothing can get around them. If a save is refused, the app is protecting the books — the message says which rule it is.',
      items: [
        'Cash and credit together must equal what the meter says was sold. A half-balanced day cannot be saved.',
        'A meter cannot run backwards. The closing reading is never below the opening one.',
        'A customer’s ledger can never be edited or deleted, by anyone. A mistake is corrected by a new entry the other way, so the history always adds up.',
        'Deleting a reading does not erase its credit slips — it posts the opposite entry, so the customer’s balance comes back to correct and the history still shows what happened.',
        'A tank cannot be given more stock than it holds, and a bank account cannot go below zero.',
        'Enter days oldest first. Two readings for one nozzle can never cover the same litres, so if a later day is already saved, the day underneath it will be refused — the message names the day to clear first.',
        'Loose oil must have a selling rate before it can be sold. Without one there is no way to tell how much oil a rupee figure is.',
        'A customer still carrying a balance cannot be removed — in either direction, whether they owe the pump or the pump owes them. Settle the account first, or the money would quietly leave the books.',
      ],
    },

    fixing: {
      heading: 'If a day was entered wrongly',
      body: 'The owner can wipe a whole day with Clear this day on Readings, then type it again. Use it when a day was entered against the wrong date — every day after it is worked out from the one before, so a wrong date spreads.',
    },

    roles: {
      heading: 'Who can see what',
      ownerLabel: 'Owner',
      staffLabel: 'Staff',
      rows: [
        { label: 'Enter readings and lubricant sales', owner: true, staff: true },
        { label: 'Record deliveries and dips', owner: true, staff: true },
        { label: 'Add customers and take payments', owner: true, staff: true },
        { label: 'See sales totals, profit and reports', owner: true, staff: false },
        { label: 'See and record expenses and banking', owner: true, staff: false },
        { label: 'Change prices, tanks and nozzles', owner: true, staff: false },
        { label: 'Correct or delete past entries', owner: true, staff: false },
      ],
    },
  },

  ur: {
    dir: 'rtl',
    switchLabel: 'Read in English',
    switchAria: 'Read this guide in English',
    title: 'یہ ایپ کیسے استعمال کریں',
    intro:
      'یہ ایپ اُس رجسٹر کی جگہ لیتی ہے جس میں پمپ کا حساب ہمیشہ سے لکھا جاتا رہا ہے۔ کام وہی ہے اور اُسی ترتیب سے ہے — دن کے آخر میں میٹر کی ریڈنگ لینا، یہ لکھنا کہ کس نے ادھار پر تیل لیا، اور نقدی گننا۔ ایپ حساب خود جوڑتی ہے، ہر گاہک کا بقایا یاد رکھتی ہے، اور جب تک دن کا حساب برابر نہ ہو، اُسے محفوظ نہیں ہونے دیتی۔',

    labels: {
      tip: 'نوٹ:',
      important: 'یہ مرحلہ ہرگز نہ چھوڑیں۔ زیادہ تر غلطیاں یہیں پکڑی جاتی ہیں۔',
      onThisPage: 'اِس صفحے میں',
    },

    stages: [
      {
        when: 'ایک بار، شروع میں',
        title: 'پمپ سیٹ کریں',
        body: 'ٹینک، نوزل، ریٹ، ملازمین، گاہک۔ یہ مالک کرتا ہے، اور صرف ایک بار۔',
      },
      {
        when: 'ہر شام',
        title: 'دن کا حساب درج کریں',
        body: 'میٹر ریڈنگ، ادھار کی پرچیاں، نقدی کی گنتی۔ دس منٹ، اور حساب مکمل۔',
      },
      {
        when: 'مہینے میں ایک بار',
        title: 'رپورٹ دیکھیں',
        body: 'فروخت، منافع، کتنا لینا ہے۔ اکاؤنٹنٹ کے لیے شیٹ ڈاؤن لوڈ کریں۔',
      },
    ],

    startHere: {
      heading: 'شروعات کہاں سے کریں',
      body: 'اگر پمپ پہلے سے سیٹ ہو چکا ہے تو نیچے «ہر شام» والے حصے پر چلے جائیں — روزانہ کا کام وہی ہے۔ یہاں دیے گئے مرحلے صرف ایک بار، مالک کی طرف سے، پہلی ریڈنگ درج ہونے سے پہلے کیے جاتے ہیں۔',
    },

    setup: {
      heading: 'ایک بار کی سیٹنگ، اِسی ترتیب سے',
      note: 'ہر مرحلہ اپنے اوپر والے پر منحصر ہے، اِس لیے ترتیب نہ بدلیں۔',
      steps: [
        {
          title: 'ٹینک',
          body: 'سیٹنگز ← ٹینک۔ ہر ٹینک درج کریں: کون سا تیل، کتنے لٹر کی گنجائش، اور آج اُس میں کتنا موجود ہے۔ یہی مقدار وہ نقطۂ آغاز ہے جس سے اسٹاک کا سارا حساب چلتا ہے۔',
        },
        {
          title: 'نوزل',
          body: 'سیٹنگز ← نوزل سیٹنگز۔ ہر نوزل درج کریں اور بتائیں کہ وہ کس ٹینک سے تیل لیتی ہے۔ یہ درست ہونا ضروری ہے — غلط ٹینک سے جڑی نوزل غلط اسٹاک میں سے تیل کم کرتی رہے گی۔',
        },
        {
          title: 'آج کے ریٹ',
          body: 'سیٹنگز ← فیول کی قیمتیں۔ پیٹرول اور ڈیزل، دونوں کا ریٹ درج کریں۔ جس دن کا ریٹ موجود نہ ہو اُس دن کی ریڈنگ درج نہیں ہو سکتی، اِس لیے یہ سب سے پہلے کریں۔',
        },
        {
          title: 'ملازمین کے لاگ اِن',
          body: 'اکاؤنٹ ← اسٹاف۔ جو بھی ریڈنگ درج کرے گا، اُسے اپنا الگ لاگ اِن دیں۔ وہ دن کا حساب درج کر سکتے ہیں، مگر منافع، اخراجات اور بینک نہیں دیکھ سکتے، نہ ہی ریٹ بدل سکتے ہیں۔',
        },
        {
          title: 'ادھار والے گاہک',
          body: 'گاہک ← نیا گاہک۔ جو بھی ادھار پر تیل لیتا ہے، اُس کی پہلی پرچی درج کرنے سے پہلے اُس کا نام یہاں ہونا ضروری ہے۔ ادھار کی حد لگانا اختیاری ہے۔',
        },
        {
          title: 'آئل (لبریکنٹ)',
          body: 'لبریکنٹ ← لبریکنٹ سنبھالیں۔ پمپ پر جو برانڈ رکھے جاتے ہیں وہ، اُن کا پیک سائز، اور آج شیلف پر کتنے لٹر موجود ہیں، درج کریں۔ یہ صرف اُس صورت میں ضروری ہے جب آئل بھی بکتا ہو۔',
        },
        {
          title: 'کھلا آئل، اگر ڈرم رکھا جاتا ہو',
          body: 'اِسی اسکرین پر، «بند ڈبے» کے بجائے قسم میں «کھلا آئل» منتخب کریں۔ نام لکھیں اور — یہ لازمی ہے — فی لٹر فروخت کا ریٹ بھی درج کریں۔ یہی ریٹ «بیس روپے کا آئل» کو ڈرم میں سے نکلنے والے لٹروں میں بدلتا ہے، اِس لیے قیمت بدلے تو ریٹ بھی بدل دیں۔',
        },
      ],
    },

    daily: {
      heading: 'ہر شام',
      note: 'پورا کام یہی ہے۔ دن میں ایک بار، دس منٹ۔',
      steps: [
        {
          title: 'ریڈنگ کھولیں',
          body: 'اوپر لکھی تاریخ آج کی ہے۔ ساری نوزلیں فہرست میں موجود ہیں، اور ہر ایک پر کل کی آخری ریڈنگ پہلے سے لکھی ہوئی ہے — ابتدائی ریڈنگ آپ کو کبھی ٹائپ نہیں کرنی پڑتی۔',
        },
        {
          title: 'ایک وقت میں ایک نوزل',
          body: 'کسی نوزل پر ٹیپ کریں اور میٹر کی آخری ریڈنگ لکھیں۔ کتنے لٹر بکے اور اُن کی رقم کیا بنی، یہ لکھتے ہی سامنے آ جاتا ہے — اِس لیے کوئی ہندسہ غلط ہو تو فوراً پکڑا جاتا ہے۔',
        },
        {
          title: 'ادھار کی پرچیاں درج کریں',
          body: 'اُس نوزل کی ہر کاغذی پرچی کے لیے «+ گاہک شامل کریں» دبائیں، گاہک منتخب کریں اور لٹر لکھیں۔ رقم آج کے ریٹ سے خود بھر جاتی ہے۔ آگے بڑھنے سے پہلے ہر پرچی درج کر لیں۔',
          tip: 'جو گاہک فہرست میں نہ ہو، اُسے پہلے «گاہک» والے حصے میں شامل کرنا پڑے گا۔',
        },
        {
          title: 'نقدی دراز سے ملائیں',
          body: 'ادھار کی پرچیاں نکالنے کے بعد جو بچتا ہے، ایپ اُسے نقد شمار کرتی ہے۔ محفوظ کرنے سے پہلے نوٹ گن کر ملا لیں۔ اگر دونوں برابر نہ ہوں تو کہیں نہ کہیں غلطی ہے — اور اِسی وقت اُسے پکڑنا سب سے آسان ہے۔',
          warn: true,
        },
        {
          title: 'نوزل محفوظ کریں',
          body: 'ہر نوزل الگ سے محفوظ ہوتی ہے، اِس لیے ایک میں غلطی باقی پانچ کو نہیں روکتی۔ ہر گاہک کا بقایا خود بخود اپ ڈیٹ ہو جاتا ہے۔ یہی سب نوزلوں پر دہرائیں یہاں تک کہ ہر ایک پر «درج ہو گئی» لکھا آ جائے۔',
        },
        {
          title: 'کاؤنٹر پر بکنے والا آئل',
          body: 'لبریکنٹ ← فروخت درج کریں۔ یہ دن کے آخر میں نہیں بلکہ جیسے ہی ڈبہ بکے، اُسی وقت درج کریں۔ پروڈکٹ منتخب کریں، پیک سائز پر ٹیپ کریں یا لٹر لکھیں، اور بتائیں کہ نقد تھا یا ادھار۔ ادھار اُسی گاہک کے کھاتے میں جاتا ہے جس میں تیل کا۔',
        },
        {
          title: 'کھلا آئل، روپوں کے حساب سے',
          body: 'لبریکنٹ ← کھلا آئل، اِس کا اپنا الگ صفحہ ہے۔ یہاں آپ وہ رقم لکھتے ہیں جو گاہک نے دی — بیس، تیس یا پچاس روپے پر ٹیپ کریں، یا کوئی بھی رقم لکھ دیں — اور ایپ خود حساب لگا کر اُتنا آئل ڈرم میں سے کم کر دیتی ہے۔ ناپنے کی ضرورت نہیں۔ لبریکنٹ والے صفحے پر دن کا کھلا آئل کا کل بھی نظر آتا ہے اور وہاں سے یہاں آنے کا لنک بھی، تاکہ پتہ چل جائے کہ دونوں حصے درج ہوئے یا نہیں۔',
          tip: 'اگر ڈرم ایپ کے حساب سے جلدی یا دیر سے خالی ہو رہا ہو تو فروخت کا ریٹ دیکھیں — لٹر اُسی سے نکالے جاتے ہیں۔',
        },
      ],
    },

    occasional: {
      heading: 'باقی کام، جب پیش آئیں',
      items: [
        {
          icon: 'purchases',
          name: 'خریداری',
          when: 'جس دن ٹینکر یا آئل کی ڈلیوری آئے۔ ڈلیوری نوٹ کے لٹر اور کل رقم درج کریں — فی لٹر ریٹ خود نکل آتا ہے۔ ادائیگی ہو چکی ہو تو «ادا شدہ» لگا دیں، ورنہ بقایا رہنے دیں۔',
        },
        {
          icon: 'stock',
          name: 'اسٹاک',
          when: 'جب ٹینکوں کا ڈپ لیا جائے۔ ڈپ درج کریں اور ایپ بتا دے گی کہ کتاب کے حساب کے مقابلے میں کمی ہوئی یا زیادتی۔ شیلف پر بچا ہوا آئل بھی یہیں نظر آتا ہے۔',
        },
        {
          icon: 'customers',
          name: 'گاہک',
          when: 'جب کوئی اپنا ادھار چکائے۔ گاہک کھولیں، ادائیگی درج کریں، بقایا کم ہو جائے گا۔ اُس کا پورا حساب اِسی اسکرین پر موجود ہے۔ غلطی سے لکھا گیا نام «ہٹائیں» سے فہرست سے نکالا جا سکتا ہے — یہ صرف مالک کر سکتا ہے، اور تبھی جب حساب برابر ہو چکا ہو۔',
        },
        {
          icon: 'banking',
          name: 'بینک',
          when: 'صرف مالک کے لیے۔ پمپ کے بینک اکاؤنٹس میں آنے اور جانے والی رقم، اور اُن سے سپلائر کو ادائیگی۔',
        },
        {
          icon: 'expenses',
          name: 'اخراجات',
          when: 'صرف مالک کے لیے۔ جو کچھ ادا ہو — تنخواہ، بجلی، مرمت — اُسی دن درج کریں۔ یہ مہینے کے منافع میں سے نکل جاتے ہیں۔',
        },
        {
          icon: 'reports',
          name: 'رپورٹس',
          when: 'صرف مالک کے لیے، مہینے میں ایک بار۔ فروخت، منافع، کتنا لینا ہے اور کتنا دینا ہے — ساتھ اکاؤنٹنٹ کے لیے شیٹ ڈاؤن لوڈ کرنے کی سہولت۔',
        },
      ],
    },

    rules: {
      heading: 'جب ایپ محفوظ کرنے سے انکار کرے',
      note: 'یہ اصول ڈیٹابیس میں خود موجود ہیں، اِس لیے اِن سے بچ نکلنا ممکن نہیں۔ اگر کوئی چیز محفوظ نہ ہو رہی ہو تو ایپ حساب کی حفاظت کر رہی ہے — پیغام میں لکھا ہوتا ہے کہ کون سا اصول ٹوٹ رہا ہے۔',
      items: [
        'نقد اور ادھار مل کر اُتنے ہی ہونے چاہئیں جتنا میٹر کے مطابق بکا ہے۔ آدھا برابر دن محفوظ نہیں ہوتا۔',
        'میٹر پیچھے نہیں چل سکتا۔ آخری ریڈنگ ابتدائی ریڈنگ سے کم نہیں ہو سکتی۔',
        'گاہک کے کھاتے میں کوئی اندراج، کسی کے لیے بھی، نہ بدلا جا سکتا ہے نہ مٹایا جا سکتا ہے۔ غلطی کی درستی الٹی طرف کا نیا اندراج ڈال کر ہوتی ہے، تاکہ حساب ہمیشہ پورا رہے۔',
        'ریڈنگ مٹانے سے اُس کی ادھار پرچیاں مٹتی نہیں — اُلٹا اندراج ڈال دیا جاتا ہے، تاکہ گاہک کا بقایا درست ہو جائے اور تاریخ میں یہ بھی لکھا رہے کہ ہوا کیا تھا۔',
        'ٹینک میں اُس کی گنجائش سے زیادہ اسٹاک درج نہیں ہو سکتا، اور بینک اکاؤنٹ صفر سے نیچے نہیں جا سکتا۔',
        'دن پرانی تاریخ سے شروع کر کے ترتیب سے درج کریں۔ ایک نوزل کی دو ریڈنگیں ایک ہی لٹر دو بار شمار نہیں کر سکتیں، اِس لیے اگر آگے کا دن پہلے سے محفوظ ہو تو اُس سے پچھلا دن قبول نہیں ہوگا — پیغام میں لکھا ہوتا ہے کہ پہلے کون سا دن مٹانا ہے۔',
        'کھلا آئل بیچنے سے پہلے اُس کا فی لٹر ریٹ درج ہونا ضروری ہے۔ ریٹ کے بغیر یہ معلوم نہیں ہو سکتا کہ اِتنے روپے کا آئل کتنا بنتا ہے۔',
        'جس گاہک کا حساب برابر نہ ہو، اُسے فہرست سے نہیں ہٹایا جا سکتا — چاہے اُس نے دینا ہو یا پمپ نے۔ پہلے حساب برابر کریں، ورنہ رقم خاموشی سے کتاب سے نکل جائے گی۔',
      ],
    },

    fixing: {
      heading: 'اگر کسی دن کا حساب غلط درج ہو جائے',
      body: 'مالک «ریڈنگ» میں «یہ دن مٹائیں» سے پورا دن ختم کر کے دوبارہ درج کر سکتا ہے۔ یہ اُس وقت استعمال کریں جب دن غلط تاریخ پر درج ہو گیا ہو — ہر اگلا دن اپنے پچھلے دن سے نکلتا ہے، اِس لیے ایک غلط تاریخ آگے تک پھیلتی چلی جاتی ہے۔',
    },

    roles: {
      heading: 'کون کیا دیکھ سکتا ہے',
      ownerLabel: 'مالک',
      staffLabel: 'ملازم',
      rows: [
        { label: 'ریڈنگ اور آئل کی فروخت درج کرنا', owner: true, staff: true },
        { label: 'ڈلیوری اور ڈپ درج کرنا', owner: true, staff: true },
        { label: 'گاہک شامل کرنا اور ادائیگی لینا', owner: true, staff: true },
        { label: 'فروخت کے کل اعداد، منافع اور رپورٹس دیکھنا', owner: true, staff: false },
        { label: 'اخراجات اور بینک دیکھنا اور درج کرنا', owner: true, staff: false },
        { label: 'ریٹ، ٹینک اور نوزل بدلنا', owner: true, staff: false },
        { label: 'پرانے اندراج درست کرنا یا مٹانا', owner: true, staff: false },
      ],
    },
  },
};
