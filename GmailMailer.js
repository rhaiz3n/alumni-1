const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'tup.cavite.mailer@gmail.com',
    pass: 'qjrh dbti iixc pdny'
  },
  tls: { rejectUnauthorized: false }
});

function sendOtpEmail(to, otp) {
  return transporter.sendMail({
    from: '"TUP Cavite" <tup.cavite.mailer@gmail.com>',
    to,
    subject: 'Your OTP Code',
    html: `<p>Your OTP is: <b>${otp}</b></p>`
  });
}

module.exports = { sendOtpEmail };
