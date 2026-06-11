// Razorpay Checkout loader + promise wrapper.

let scriptLoaded = false;

function loadScript(): Promise<boolean> {
  if (scriptLoaded || (window as any).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => {
      scriptLoaded = true;
      resolve(true);
    };
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export interface RzpHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface OpenRazorpayOpts {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  prefill?: { name?: string; email?: string };
}

/** Opens Razorpay Checkout and resolves with the payment response (rejects if dismissed). */
export async function openRazorpay(
  opts: OpenRazorpayOpts,
): Promise<RzpHandlerResponse> {
  const ok = await loadScript();
  if (!ok || !(window as any).Razorpay) {
    throw new Error('Could not load the payment SDK. Check your connection.');
  }
  return new Promise((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: opts.keyId,
      amount: opts.amount,
      currency: opts.currency,
      order_id: opts.orderId,
      name: 'EduPro',
      description: opts.description,
      prefill: opts.prefill ?? {},
      theme: { color: '#4f46e5' },
      handler: (r: RzpHandlerResponse) => resolve(r),
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    rzp.open();
  });
}
