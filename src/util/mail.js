const nodemailer = require("nodemailer");
const logger = console;

const resolveMailConfig = () => ({
  senderEmail: String(process.env.SENDER_EMAIL || process.env.EMAIL_USER || "").trim(),
  appPassword: String(process.env.APP_PASSWORD || process.env.EMAIL_PASS || "").trim(),
  smtpHost: String(process.env.SMTP_HOST || "").trim(),
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || "").trim() === "true",
});

module.exports = () => {
  const sendMail = async (rec_mail, subject, text, html) => {
    if (String(process.env.DISABLE_EMAIL_SEND || "").trim().toLowerCase() === "true") {
      logger.info("Email send skipped", { to: rec_mail, subject });
      return { skipped: true };
    }

    const { senderEmail, appPassword, smtpHost, smtpPort, smtpSecure } =
      resolveMailConfig();

    if (!senderEmail || !appPassword) {
      throw new Error("Email service not configured. Set SENDER_EMAIL and APP_PASSWORD in .env");
    }
    try {
      const transporter = smtpHost
        ? nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
              user: senderEmail,
              pass: appPassword,
            },
          })
        : nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: senderEmail,
              pass: appPassword,
            },
          });

      const mailOptions = {
        from: senderEmail,
        to: rec_mail,
        subject: subject,
        text: text,
        html: html,
      };
      const info = await transporter.sendMail(mailOptions);
      logger.info("Mail sent", { to: rec_mail, messageId: info.messageId });
      return info;
    } catch (error) {
      logger.error("Failed to send email", {
        to: rec_mail,
        error: error.message,
      });
      throw error;
    }
  };
  return {
    sendMail,
  };
};
