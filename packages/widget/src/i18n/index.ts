const en = {
  title: 'Shopping assistant',
  subtitle: 'Ask me anything about our products',
  suggestions: 'Suggestions',
  suggestionBestRated: 'What are your best-rated products?',
  suggestionGift: 'Help me find a gift under $50',
  suggestionCart: 'Show my cart',
  sale: 'Sale',
  open: 'Open shopping assistant',
  close: 'Close',
  closeAssistant: 'Close shopping assistant',
  greeting:
    'Hi! I can help you find products, compare them and manage your cart. What are you looking for?',
  placeholder: 'Ask about products…',
  send: 'Send',
  messageLabel: 'Message',
  typing: 'The assistant is typing',
  you: 'You',
  assistant: 'Assistant',
  conversation: 'Conversation',
  addToCart: 'Add to cart',
  addToCartMessage: 'Add "{title}" to my cart.',
  addVariantMessage: 'Add "{title}" ({variant}) to my cart.',
  outOfStock: 'Out of stock',
  inStock: 'In stock',
  options: '{count} options',
  rating: '{average} out of 5 ({count} reviews)',
  chooseOption: 'Choose an option for {title}',
  compare: 'Product comparison',
  feature: 'Feature',
  price: 'Price',
  availability: 'Availability',
  yes: 'Yes',
  no: 'No',
  cart: 'Cart',
  cartCount: 'Cart, {count} items',
  cartEmpty: 'Your cart is empty.',
  quantity: 'Qty {count}',
  subtotal: 'Subtotal',
  discount: 'Discount',
  total: 'Total',
  checkout: 'Go to checkout',
  checkoutHint: 'You will pay securely on the store.',
  showCart: 'Show my cart',
  toolSearching: 'Searching products…',
  toolComparing: 'Comparing products…',
  toolCart: 'Updating your cart…',
  toolWorking: 'Working on it…',
  notSent: 'Not sent',
  retry: 'Try again',
  errorGeneric: 'Something went wrong. Please try again.',
  errorOffline: 'Could not reach the assistant. Check your connection and try again.',
  errorRateLimited: 'You are sending messages too quickly. Try again in {seconds} seconds.',
  errorBusy: 'Please wait for the current answer to finish.',
  sessionRestarted: 'Your earlier conversation expired, so this is a fresh start.',
};

export type Strings = typeof en;
export type StringKey = keyof Strings;

const ar: Strings = {
  title: 'مساعد التسوق',
  subtitle: 'اسألني أي شيء عن منتجاتنا',
  suggestions: 'اقتراحات',
  suggestionBestRated: 'ما هي أفضل منتجاتكم تقييماً؟',
  suggestionGift: 'ساعدني في اختيار هدية بأقل من 50 دولاراً',
  suggestionCart: 'اعرض سلتي',
  sale: 'تخفيض',
  open: 'افتح مساعد التسوق',
  close: 'إغلاق',
  closeAssistant: 'أغلق مساعد التسوق',
  greeting: 'مرحباً! يمكنني مساعدتك في العثور على المنتجات ومقارنتها وإدارة سلة التسوق. عمّ تبحث؟',
  placeholder: 'اسأل عن المنتجات…',
  send: 'إرسال',
  messageLabel: 'الرسالة',
  typing: 'المساعد يكتب',
  you: 'أنت',
  assistant: 'المساعد',
  conversation: 'المحادثة',
  addToCart: 'أضف إلى السلة',
  addToCartMessage: 'أضف "{title}" إلى سلتي.',
  addVariantMessage: 'أضف "{title}" ({variant}) إلى سلتي.',
  outOfStock: 'غير متوفر',
  inStock: 'متوفر',
  options: '{count} خيارات',
  rating: '{average} من 5 ({count} تقييم)',
  chooseOption: 'اختر خياراً لـ {title}',
  compare: 'مقارنة المنتجات',
  feature: 'الميزة',
  price: 'السعر',
  availability: 'التوفر',
  yes: 'نعم',
  no: 'لا',
  cart: 'السلة',
  cartCount: 'السلة، {count} منتجات',
  cartEmpty: 'سلتك فارغة.',
  quantity: 'الكمية {count}',
  subtotal: 'المجموع الفرعي',
  discount: 'الخصم',
  total: 'الإجمالي',
  checkout: 'إتمام الشراء',
  checkoutHint: 'ستدفع بأمان على موقع المتجر.',
  showCart: 'اعرض سلتي',
  toolSearching: 'جارٍ البحث عن المنتجات…',
  toolComparing: 'جارٍ مقارنة المنتجات…',
  toolCart: 'جارٍ تحديث السلة…',
  toolWorking: 'جارٍ العمل…',
  notSent: 'لم تُرسل',
  retry: 'حاول مرة أخرى',
  errorGeneric: 'حدث خطأ ما. حاول مرة أخرى.',
  errorOffline: 'تعذر الوصول إلى المساعد. تحقق من اتصالك وحاول مرة أخرى.',
  errorRateLimited: 'أنت ترسل الرسائل بسرعة كبيرة. حاول مرة أخرى بعد {seconds} ثانية.',
  errorBusy: 'يرجى انتظار انتهاء الرد الحالي.',
  sessionRestarted: 'انتهت محادثتك السابقة، لذا هذه بداية جديدة.',
};

/** Add a language by adding its strings here; untranslated languages fall back to English. */
export const LANGUAGES: Record<string, Strings> = { en, ar };

/** Languages written right to left, whether or not their strings are bundled. */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv']);

const baseOf = (language: string) => language.toLowerCase().split(/[-_]/)[0] ?? 'en';

export const directionOf = (language: string): 'ltr' | 'rtl' =>
  RTL_LANGUAGES.has(baseOf(language)) ? 'rtl' : 'ltr';

export type Translate = (key: StringKey, values?: Record<string, string | number>) => string;

export function createTranslator(language: string, overrides: Partial<Strings> = {}): Translate {
  const strings = { ...en, ...LANGUAGES[baseOf(language)], ...overrides };
  return (key, values = {}) =>
    strings[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      name in values ? String(values[name]) : placeholder,
    );
}
