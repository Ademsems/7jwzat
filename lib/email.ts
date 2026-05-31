import { Resend } from "resend";

// Lazily create the client inside each function so this module can be
// imported during Next.js build without RESEND_API_KEY being present.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@resend.dev";

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-AE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

/* ── Customer confirmation ─────────────────────────────────────── */
export async function sendCustomerEmail(opts: {
  customerName: string;
  customerEmail: string;
  serviceName: string;
  duration: number;
  price: number;
  bookingDate: string;
  bookingTime: string;
  businessName: string;
}) {
  const { customerName, customerEmail, serviceName, duration, price,
          bookingDate, bookingTime, businessName } = opts;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <!-- Header -->
    <div style="background:#4f46e5;padding:32px 40px;text-align:center">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700">${businessName}</h1>
      <p style="color:#c7d2fe;margin:8px 0 0;font-size:14px">Booking Confirmation</p>
    </div>
    <!-- Body -->
    <div style="padding:40px">
      <p style="color:#374151;font-size:16px;margin:0 0 24px">Hi ${customerName},</p>
      <p style="color:#374151;font-size:15px;margin:0 0 24px">
        Your appointment has been confirmed! Here are your booking details:
      </p>
      <!-- Details box -->
      <div style="background:#f5f3ff;border-radius:10px;padding:24px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0;width:40%">Service</td>
            <td style="color:#111827;font-size:13px;font-weight:600;padding:6px 0">${serviceName}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Duration</td>
            <td style="color:#111827;font-size:13px;font-weight:600;padding:6px 0">${duration} minutes</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Price</td>
            <td style="color:#4f46e5;font-size:13px;font-weight:600;padding:6px 0">AED ${price.toFixed(2)}</td>
          </tr>
          <tr><td colspan="2" style="border-top:1px solid #ddd6fe;padding:4px 0"></td></tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Date</td>
            <td style="color:#111827;font-size:13px;font-weight:600;padding:6px 0">${fmtDate(bookingDate)}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Time</td>
            <td style="color:#111827;font-size:13px;font-weight:600;padding:6px 0">${bookingTime}</td>
          </tr>
        </table>
      </div>
      <p style="color:#6b7280;font-size:13px;margin:0">
        Please keep this email for your records. We look forward to seeing you!
      </p>
    </div>
    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">Powered by 7jwzat &middot; Smart Booking System</p>
    </div>
  </div>
</body>
</html>`;

  return getResend().emails.send({
    from: FROM,
    to: customerEmail,
    subject: `Your Appointment is Confirmed - ${businessName}`,
    html,
  });
}

/* ── Business owner notification ───────────────────────────────── */
export async function sendOwnerEmail(opts: {
  ownerEmail: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string | null;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  businessName: string;
}) {
  const { ownerEmail, customerName, customerEmail, customerPhone, notes,
          serviceName, bookingDate, bookingTime, businessName } = opts;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#4f46e5;padding:32px 40px">
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700">New Booking!</h1>
      <p style="color:#c7d2fe;margin:8px 0 0;font-size:14px">${businessName}</p>
    </div>
    <div style="padding:40px">
      <p style="color:#374151;font-size:15px;margin:0 0 24px">You have a new appointment booking:</p>
      <div style="background:#f5f3ff;border-radius:10px;padding:24px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0;width:40%">Customer</td>
            <td style="color:#111827;font-size:13px;font-weight:600;padding:6px 0">${customerName}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Phone</td>
            <td style="color:#111827;font-size:13px;font-weight:600;padding:6px 0">${customerPhone}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Email</td>
            <td style="color:#111827;font-size:13px;font-weight:600;padding:6px 0">${customerEmail}</td>
          </tr>
          <tr><td colspan="2" style="border-top:1px solid #ddd6fe;padding:4px 0"></td></tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Service</td>
            <td style="color:#111827;font-size:13px;font-weight:600;padding:6px 0">${serviceName}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Date</td>
            <td style="color:#111827;font-size:13px;font-weight:600;padding:6px 0">${fmtDate(bookingDate)}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Time</td>
            <td style="color:#111827;font-size:13px;font-weight:600;padding:6px 0">${bookingTime}</td>
          </tr>
          ${notes ? `<tr>
            <td style="color:#6b7280;font-size:13px;padding:6px 0">Notes</td>
            <td style="color:#111827;font-size:13px;padding:6px 0">${notes}</td>
          </tr>` : ""}
        </table>
      </div>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard/bookings"
         style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        View in Dashboard
      </a>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">Powered by 7jwzat &middot; Smart Booking System</p>
    </div>
  </div>
</body>
</html>`;

  return getResend().emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `New Booking: ${serviceName} from ${customerName}`,
    html,
  });
}