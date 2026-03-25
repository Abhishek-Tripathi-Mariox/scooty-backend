const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stationAdminOtpEmailTemplate = ({
  name = "Station Admin",
  otp,
  expiresInSec = 300,
  purpose = "login",
}) => {
  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(otp);
  const safePurpose = purpose === "forgot-password" ? "password reset" : "login";
  const minutes = Math.max(1, Math.ceil(Number(expiresInSec || 300) / 60));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Station Admin OTP</title>
  </head>
  <body style="margin:0;padding:0;background:#d9d5d1;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#d9d5d1 0%,#dfdad5 100%);padding:28px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:linear-gradient(180deg,#fff2e6 0%,#ffe8d7 100%);border-radius:24px;overflow:hidden;box-shadow:0 16px 36px rgba(15,23,42,0.12);">
            <tr>
              <td style="padding:30px 32px 18px;text-align:center;">
                <div style="display:inline-block;background:rgba(255,255,255,0.58);border:1px solid rgba(255,122,26,0.12);border-radius:999px;padding:8px 14px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#ff6a1a;font-weight:700;">
                  Scooty Rental
                </div>
                <div style="font-size:30px;line-height:1.15;font-weight:800;color:#1f2328;margin-top:18px;letter-spacing:-0.3px;">Station Admin OTP</div>
                <div style="font-size:15px;line-height:1.7;color:#6b7280;margin-top:10px;max-width:500px;margin-left:auto;margin-right:auto;">
                  Use this code to complete your ${safePurpose} securely.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 30px;">
                <div style="background:rgba(255,255,255,0.62);border:1px solid rgba(255,255,255,0.55);border-radius:22px;padding:26px 22px;backdrop-filter:blur(2px);">
                <div style="font-size:16px;line-height:1.7;margin:0 0 12px;font-weight:700;color:#1f2937;">Hi ${safeName},</div>
                <div style="font-size:15px;line-height:1.8;margin:0 0 22px;color:#4b5563;">
                  We received a request for your station admin ${safePurpose}. Enter the one-time password below in the app to continue.
                </div>
                <div style="text-align:center;margin:22px 0 20px;">
                  <div style="display:inline-block;background:linear-gradient(180deg,#fff6ef 0%,#ffe6d2 100%);border:1px solid rgba(255,122,26,0.18);border-radius:18px;padding:18px 28px;font-size:34px;letter-spacing:8px;font-weight:800;color:#ff5a12;box-shadow:0 8px 20px rgba(255,106,26,0.12);">
                    ${safeOtp}
                  </div>
                </div>
                <div style="background:linear-gradient(180deg,#fff8f2 0%,#fff2e9 100%);border:1px solid rgba(255,122,26,0.12);border-radius:18px;padding:18px 20px;">
                  <div style="font-size:14px;line-height:1.7;color:#4b5563;">
                    This OTP will expire in <strong>${minutes} minute${minutes > 1 ? "s" : ""}</strong>.
                  </div>
                  <div style="font-size:14px;line-height:1.7;color:#4b5563;margin-top:8px;">
                    If you did not request this code, you can safely ignore this email.
                  </div>
                </div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

module.exports = {
  stationAdminOtpEmailTemplate,
};
