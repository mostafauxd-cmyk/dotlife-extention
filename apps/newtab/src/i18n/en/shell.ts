/** English for the shell part of the page (see `index.ts`). Keys are the Persian exactly as in the code. */
export const SHELL: Readonly<Record<string, string>> = {
  // the page itself (App.tsx), the rail, the dot, the edge
  "از گوشی · همین حالا": "From your phone · just now",
  "از سرچ · همین حالا": "From the search · just now",
  "ذخیره شد · روی گوشی هم هست": "Saved · it's on your phone too",
  "حساب نقطه‌ات ساخته شد": "Your Noghte account is ready",
  خانه: "Home",
  اسلایدها: "Slides",
  "نقطه؛ برای کشیدن دوباره بزن": "Noghte; click to draw it again",
  "بوکمارک‌ها و شخصی‌سازی": "Bookmarks and Customize",
  "بوکمارک‌های کروم": "Chrome bookmarks",
  "نوار بوکمارک کروم خالی است.": "Chrome's bookmarks bar is empty.",

  // Customize
  شخصی‌سازی: "Customize",
  "بخش‌های شخصی‌سازی": "Customize sections",
  "درباره‌ی من": "About me",
  صفحه: "Page",
  ظاهر: "Look",
  زبان: "Language",
  "زبان همه‌ی نوشته‌های این صفحه.": "The language of everything on this page.",
  "حساب نقطه": "Noghte account",
  "کارها و یادداشت‌ها با اپ نقطه یکی می‌شوند.":
    "Your tasks and notes stay in step with the Noghte app.",
  "هنوز همگام نشده": "Not synced yet",
  "همگام‌شده {when}": "Synced {when}",
  همگام‌سازی: "Sync",
  خروج: "Sign out",
  "چند تا هم می‌شود؛ برای هر کدام پوشه‌ای از سایت‌هایش به دسترسی سریع زیر سرچ اضافه می‌شود.":
    "Pick several if you like; each adds a folder of its sites to the quick-access row under the search.",
  "شهر تو": "Your city",
  "برای رویدادها و پیشنهادهای نزدیک‌تر؛ اختیاری است.":
    "For events and suggestions closer to you; optional.",
  علاقه‌هایت: "Your interests",
  "هر چند تا که خواستی؛ اختیاری است.": "As many as you like; optional.",
  علاقه‌ها: "Interests",
  "صفحه‌ی اول": "First view",
  "صفحه‌ی اول فقط نقطه و سرچ است؛ بقیه در گوشه‌ها و لبه منتظرند.":
    "The first view is just Noghte and the search; the rest waits in the corners and on the edge.",
  "زیر صفحه‌ی اول، به همین ترتیب. خانه همیشه اول است.":
    "Below the first view, in this order. Home is always first.",
  بالاتر: "Move up",
  پایین‌تر: "Move down",
  "رنگ پس‌زمینه": "Background colour",
  "از نو": "Start over",
  "چیدمان صفحه، اسلایدها و رنگ را به حالت اول برمی‌گرداند؛ شهر و علاقه‌هایت هم پاک می‌شود.":
    "Puts the page layout, slides and colour back as they were; your city and interests are cleared too.",
  "چیدمان پیش‌فرض": "Default layout",

  // theme names (settings.ts THEMES)
  نقطه: "Noghte",
  گرافیت: "Graphite",
  آسمان: "Sky",
  کهربا: "Amber",
  جنگل: "Forest",
  "شب بنفش": "Purple night",
  رز: "Rose",

  // parts of the page and slides (settings.ts BLOCKS, SLIDES)
  "ردیف دسترسی سریع": "Quick-access row",
  "تاریخ زیر سرچ": "Date under the search",
  "کارت‌ها همیشه باز": "Cards always open",
  "باز شدن گوشه با تغییر تازه": "Open a corner when something new arrives",
  "افکت ورود": "Opening effect",
  برنامه‌ها: "Plans",
  پول: "Money",

  // personas (personas.ts)
  "کدام بیشتر شبیه توست؟ (چند تا هم می‌شود)": "Which sounds most like you? (You can pick several)",
  طراح: "Designer",
  "فیگما، دریبل، فونت‌ها": "Figma, Dribbble, fonts",
  برنامه‌نویس: "Developer",
  "گیت‌هاب، MDN، لیارا": "GitHub, MDN, Liara",
  حسابدار: "Accountant",
  "مودیان، تأمین اجتماعی، کدال": "Tax portal, social security, Codal",
  دانشجو: "Student",
  "اسکالر، ایرانداک، فرادرس": "Scholar, IranDoc, Faradars",
  "فروشنده‌ی آنلاین": "Online seller",
  "باسلام، ترب، تیپاکس": "Basalam, Torob, Tipax",
  "مدیر و کارمند": "Manager or employee",
  "جیمیل، تقویم، اسکای‌روم": "Gmail, Calendar, Skyroom",

  // interests (cities.ts INTERESTS)
  سفر: "Travel",
  اقتصاد: "Economy",
  ورزش: "Sports",
  فرهنگ: "Culture",
  خودرو: "Cars",
  غذا: "Food",
  کتاب: "Books",
  موسیقی: "Music",
  سینما: "Cinema",
  بازی: "Games",
  آموزش: "Learning",
  "مد و پوشاک": "Fashion",
  "خانه و دکور": "Home and decor",
  املاک: "Real estate",
  کسب‌وکار: "Business",
  هنر: "Art",

  // the city picker
  "برداشتن {city}": "Remove {city}",
  "شهرت را بنویس…": "Type your city…",
  شهر: "City",
  "شهرهای پرتکرار": "Popular cities",
  شهرها: "Cities",
  "افزودن «{city}»": "Add “{city}”",

  // the quick-access row (Launcher.tsx)
  "{action} {name}": "{action}: {name}",
  برداشتن: "Remove",
  "پوشه‌ی {name}": "Folder {name}",
  "پوشه‌ی تازه": "New folder",
  "بستن پوشه": "Close folder",
  "اسم پوشه": "Folder name",
  پوشه: "Folder",
  "بیرون آوردن از پوشه": "Take out of the folder",
  "افزودن به این پوشه": "Add to this folder",
  "افزودن به دسترسی سریع": "Add to quick access",
  "سایت تازه": "New site",
  "سایت‌هایی که زیاد باز می‌کنی": "Sites you open often",
  آدرس: "Address",
  "نام (اختیاری)": "Name (optional)",

  // the search box
  "در گوگل جستجو کن یا آدرس بنویس…": "Search Google or type an address…",
  "Enter جستجو · Shift+Enter خط تازه": "Enter to search · Shift+Enter for a new line",
  "جستجو در گوگل": "Search Google",
  "کار تازه…": "New task…",
  "Enter افزودن به کارها · Esc برگشت به جستجو": "Enter adds to tasks · Esc back to search",
  "افزودن به کارها": "Add to tasks",
  "عنوان یادداشت تازه…": "New note title…",
  "Enter ذخیره · Tab توضیح · Esc برگشت": "Enter to save · Tab for details · Esc to go back",
  "ذخیره در یادداشت‌ها": "Save to notes",
  "نوشتن کار تازه به‌جای جستجو": "Write a new task instead of searching",
  "به کارها": "To tasks",
  "نوشتن یادداشت تازه به‌جای جستجو": "Write a new note instead of searching",
  "به یادداشت‌ها": "To notes",
  "پیشنهادهای گوگل": "Google suggestions",
  "توضیح… (اختیاری؛ عنوان همان متن بالاست)": "Details… (optional; the title is the text above)",
  "توضیح یادداشت": "Note details",
  "کی؟": "When?",
  فردا: "Tomorrow",
  در: "In",
  دسته: "Category",
  "یادداشت‌های اخیر": "Recent notes",
  "کارهای اخیر": "Recent tasks",
  "یادداشت بی‌عنوان": "Untitled note",
  "هنوز یادداشتی نیست. همین‌که ذخیره کنی، این‌جا پیدایش می‌شود.":
    "No notes yet. As soon as you save one, it shows up here.",
  "هنوز کاری نیست. همین‌که ذخیره کنی، این‌جا پیدایش می‌شود.":
    "No tasks yet. As soon as you save one, it shows up here.",

  // syncing (SyncAvatar.tsx, the corners' badge)
  "وارد نقطه نشده‌ای؛ کارها و یادداشت‌ها فقط روی همین مرورگرند":
    "You're not signed in to Noghte; your tasks and notes are only in this browser",
  "در حال همگام‌سازی با گوشی…": "Syncing with your phone…",
  "آفلاین؛ وقتی وصل شدی می‌فرستم": "Offline; I'll send it when you're back online",
  "همگام نشد؛ دوباره امتحان می‌کنم": "Sync failed; I'll try again",
  "همگام با گوشی": "In sync with your phone",
  "همگام با گوشی · {when}": "In sync with your phone · {when}",
  "شخصی‌سازی و حساب — {status}": "Customize and account — {status}",
  "همگام‌سازی…": "Syncing…",
  "در حال همگام‌سازی با گوشی": "Syncing with your phone",
  ناهمگام: "Not synced",
  "روی این مرورگر": "In this browser",
  "فقط روی همین مرورگر نگه داشته می‌شود؛ با ورود به نقطه روی گوشی هم می‌آید":
    "Kept in this browser only; sign in to Noghte to have it on your phone too",

  // the corners
  "وارد شو تا این‌جا و گوشی یکی شوند. نقطه را نداری؟ کد را با گوشی اسکن کن.":
    "Sign in so this page and your phone stay in step. Don't have Noghte? Scan the code with your phone.",
  "ورود به نقطه": "Sign in to Noghte",
  "کد نصب نقطه از کافه‌بازار": "Code to install Noghte from Cafe Bazaar",
  "کارهای امروز": "Today's tasks",
  "کارهای گوشی‌ات، همین‌جا": "Your phone's tasks, right here",
  "برای امروز کاری نیست.": "Nothing to do today.",
  "کار جدید…": "New task…",
  "روی گوشی هم داشته باش": "Have it on your phone too",
  "وارد شو؛ این‌جا و گوشی‌ات یکی می‌شوند.": "Sign in; this page and your phone stay in step.",
  "یادداشت سریع بنویس… خط اول، عنوانش می‌شود.":
    "Jot a quick note… the first line becomes its title.",
  "یادداشت سریع": "Quick note",
  "روی گوشی هم دیده می‌شود": "Shows on your phone too",
  "روی همین مرورگر نگه داشته می‌شود": "Kept in this browser",
  "ذخیره‌ی یادداشت": "Save note",
  "یادداشت‌های گوشی‌ات، همین‌جا": "Your phone's notes, right here",
  "هنوز یادداشتی نیست.": "No notes yet.",
  "پاکت وصل است": "Paket is connected",
  "پولت را هم ببین": "See your money too",
  "موجودی و خرج ماهت در صفحه‌ی «پول» است.":
    "Your balance and this month's spending are on the Money slide.",
  "پاکت را وصل کن تا موجودی، خرج ماه و دارایی‌هایت را همین‌جا ببینی؛ فقط خواندنی است.":
    "Connect Paket to see your balance, monthly spending and assets right here; it's read-only.",
  "ورود به پاکت": "Sign in to Paket",

  // updates (UpdateNotice.tsx)
  "نقطه به نسخه‌ی {v} به‌روز شد": "Noghte was updated to version {v}",
  "نسخه‌ی تازه‌ی نقطه ({v}) آماده است": "A new version of Noghte ({v}) is ready",
  به‌روزرسانی: "Update",
  "نسخه‌ی {v} نقطه آمده": "Noghte {v} is out",
  "چطور به‌روز کنم؟": "How do I update?",
  "به‌روزرسانی نقطه": "Update Noghte",
  "به‌روزرسانی به نسخه‌ی {v}": "Update to version {v}",
  "این نقطه از یک پوشه نصب شده و خودش به‌روز نمی‌شود. سه قدم تا نسخه‌ی تازه:":
    "This Noghte was installed from a folder and doesn't update itself. Three steps to the new version:",
  "نسخه‌ی تازه را بگیر": "Get the new version",
  "فایل زیپ را دانلود کن و باز کن.": "Download the zip file and unzip it.",
  "جای پوشه‌ی قبلی بگذار": "Put it in place of the old folder",
  "محتوای پوشه‌ی تازه را روی همان پوشه‌ای بریز که نقطه از آن نصب شده.":
    "Copy the new folder's contents over the folder Noghte was installed from.",
  "در صفحه‌ی افزونه‌ها بارگذاری دوباره بزن": "Reload it on the Extensions page",
  "کنار نقطه دکمه‌ی ↻ را بزن. کارها و یادداشت‌هایت سر جایشان می‌مانند.":
    "Click the ↻ button next to Noghte. Your tasks and notes stay where they are.",
  "دانلود نسخه‌ی تازه": "Download the new version",
  "باز کردن صفحه‌ی افزونه‌ها": "Open the Extensions page",
  "کروم افزونه‌ها را خودش به‌روز می‌کند، ولی گاهی چند ساعت طول می‌کشد یا اینترنت جلویش را می‌گیرد.":
    "Chrome updates extensions by itself, but sometimes it takes a few hours or the internet gets in the way.",
  "یک بار «بررسی دوباره» را بزن": "Click “Check again” once",
  "اگر نسخه‌ی تازه پیدا شود، همین‌جا نصبش می‌کنیم.":
    "If a new version is found, we'll install it right here.",
  "اگر نشد، از صفحه‌ی افزونه‌ها": "If not, from the Extensions page",
  "«حالت توسعه‌دهنده» (Developer mode) را بالای صفحه روشن کن و دکمه‌ی «به‌روزرسانی» (Update) را بزن.":
    "Turn on Developer mode at the top of the page and click Update.",
  "کروم هنوز نسخه‌ی تازه را نمی‌بیند؛ قدم دوم را امتحان کن.":
    "Chrome doesn't see the new version yet; try step two.",
  "کروم به فروشگاه وصل نشد؛ قدم دوم را امتحان کن.":
    "Chrome couldn't reach the store; try step two.",
  "در حال بررسی…": "Checking…",
  "بررسی دوباره": "Check again",

  // the painting beside the sign-in (Painting.tsx)
  "در گوگل جستجو کن…": "Search Google…",
  "زنگ به آقای رحیمی": "Call Mr. Rahimi",
  "پرداخت قبض برق": "Pay the electricity bill",
};
