/** The welcome, the language step, linking and signing in (`home/SignIn.tsx`), and shared words. */
export const HOME: Readonly<Record<string, string>> = {
  // shared
  "همین حالا": "just now",
  "{n} دقیقه پیش": "{n} min ago",
  "{n} ساعت پیش": "{n} h ago",
  دیروز: "yesterday",
  "{n} روز پیش": "{n} days ago",
  "{n} ثانیه": "{n} s",
  بعداً: "Later",
  ادامه: "Continue",
  برگشت: "Back",

  // the welcome
  "نقطه را به چه زبانی ببینی؟ بعداً هم در شخصی‌سازی عوض می‌شود.":
    "Which language would you like Noghte in? You can change it later in Customize.",
  شروع: "Start",
  "نقطه،": "Noghte,",
  "صفحه‌ی اول کروم تو": "your Chrome's first page",
  "کارها، یادداشت‌ها، تقویم و قیمت‌های روز، روی هر تب تازه.":
    "Tasks, notes, your calendar and today's prices, on every new tab.",
  "کارهای گوشی، روی هر تب تازه": "Your phone's tasks, on every new tab",
  "تیک بزنی، روی گوشی هم تیک می‌خورد.": "Tick one here and it's ticked on your phone too.",
  "هر چه این‌جا بنویسی، روی گوشی هم هست": "Whatever you write here is on your phone too",
  "از همین سرچ، بی‌آن‌که گوشی را برداری.":
    "Right from the search box, without picking up your phone.",
  "چیزی گم نمی‌شود": "Nothing gets lost",
  "کروم پاک شود یا سیستم عوض شود، همه برمی‌گردد.":
    "Clear Chrome or change computers, and it all comes back.",
  "رایگان است و کمتر از یک دقیقه طول می‌کشد.": "It's free and takes less than a minute.",
  "کدام بیشتر شبیه توست؟": "Which sounds most like you?",
  "هر چند تا که به تو می‌خورد را انتخاب کن؛ دسترسی سریع زیر سرچ را با سایت‌های همین کارها می‌چینیم. هر وقت خواستی در شخصی‌سازی عوضش کن.":
    "Pick as many as fit you; we'll fill the quick-access row under the search with their sites. Change it any time in Customize.",

  // linking with the phone
  "به نقطه‌ی گوشی‌ات وصل شو": "Connect to Noghte on your phone",
  "کارها و یادداشت‌ها بین این صفحه و گوشی یکی می‌شوند. اختیاری است؛ بدون آن هم همه چیز روی همین مرورگر کار می‌کند.":
    "Your tasks and notes stay the same here and on your phone. It's optional; everything works in this browser without it.",
  "کد اتصال به اپ نقطه": "Code to connect the Noghte app",
  "در حال ساختن کد…": "Making the code…",
  "کد نصب نقطه": "Code to install Noghte",
  "نقطه را با این کد روی گوشی نصب کن.": "Install Noghte on your phone with this code.",
  "بعد با شماره‌ی موبایلت همین‌جا وارد شو.": "Then sign in here with your mobile number.",
  "اپ نقطه را روی گوشی باز کن.": "Open the Noghte app on your phone.",
  "در پروفایل، «دستگاه‌ها و افزونه» را باز کن و «اسکن کد افزونه» را بزن.":
    "In your profile, open Devices & extension and tap Scan extension code.",
  "دوربین را روی این کد بگیر؛ همین‌جا خودکار وصل می‌شوی.":
    "Point the camera at this code; you'll be connected here automatically.",
  "فعلاً نه": "Not now",
  "با شماره‌ی موبایل وارد شو": "Sign in with a mobile number",

  // the phone number and the code
  "با شماره‌ات وارد شو": "Sign in with your number",
  "حساب نداری؟ با همین شماره ساخته می‌شود. هر چه این‌جا بنویسی روی گوشی هم دیده می‌شود.":
    "No account? One is made with this number. Whatever you write here shows on your phone too.",
  "شماره‌ی موبایل": "Mobile number",
  "فرستادن کد": "Send code",
  "با ادامه، حریم خصوصی نقطه را می‌پذیرم.": "By continuing, I accept Noghte's privacy policy.",
  "کد را بنویس": "Enter the code",
  "کدی که به {phone} پیامک شد.": "The code texted to {phone}.",
  "کد ورود": "Sign-in code",
  "کد تازه تا {wait}": "New code in {wait}",
  "کد تازه تا {wait}.": "New code in {wait}.",
  "کد تازه بفرست": "Send a new code",
  ورود: "Sign in",
  "این شماره درست نیست.": "This number isn't right.",
  "کمی صبر کن و دوباره بخواه.": "Wait a moment and ask again.",
  "بیش از حد درخواست شد؛ کمی بعد دوباره امتحان کن.": "Too many requests; try again a bit later.",
  "ورود با پیامک فعلاً بسته است.": "Signing in by SMS is closed for now.",
  "پیامک به این شماره نمی‌رسد.": "SMS can't reach this number.",
  "پیامک فرستاده نشد؛ دوباره امتحان کن.": "The SMS wasn't sent; try again.",
  "کد درست نیست.": "The code isn't right.",
  "کد منقضی شده؛ کد تازه بخواه.": "The code has expired; ask for a new one.",
  "تلاش‌ها تمام شد؛ کد تازه بخواه.": "No tries left; ask for a new code.",
  "به سرور نقطه وصل نشد. اینترنت را بررسی کن.":
    "Couldn't reach Noghte's server. Check your internet.",
  "این بخش فعلاً بسته است.": "This part is closed for now.",
  "مشکلی پیش آمد؛ دوباره امتحان کن.": "Something went wrong; try again.",
  "مشکلی پیش آمد.": "Something went wrong.",
};
