const express = require("express");
const {
  userRegister,
  activeUserAccountByCode,
  userLogin,
  userLogout,
  resendActivationCode,
  me,
  dashboardLogin,
} = require("../controllers/auth.controllers");
const { isLoggedOut, isLoggedIn } = require("../middlewares/verify");
const limiter = require("../middlewares/limiter");
const authRouter = express.Router();

// user register
authRouter.route("/register").post(isLoggedOut, limiter(10), userRegister);

// active user account by URL  [ link off ]
// authRouter.route("/activate/:token").get(
//   isLoggedOut,
//    activeUserAccountByURL);

// active user account by code
authRouter.route("/activate").post(isLoggedOut, activeUserAccountByCode);

// resend verification code  to email
authRouter.route("/resend-active-code").post(isLoggedOut, resendActivationCode);

// user login
authRouter.route("/login").post(isLoggedOut, userLogin);

// dashboard login
authRouter
  .route("/dashboard-login")
  .post(isLoggedOut, limiter(10), dashboardLogin);

// // find account
// authRouter
//   .route("/find-account")
//   .post(isLoggedOut, findAccountValidator, runValidation, findAccount);

// // user logout
authRouter.route("/logout").post(isLoggedIn, userLogout);

// // password reset code
// authRouter
//   .route("/password-reset-code")
//   .post(
//     isLoggedOut,
//     passwordResetRequestValidator,
//     runValidation,
//     passwordResetRequest
//   );

// // password reset
// authRouter
//   .route("/password-reset")
//   .post(isLoggedOut, passwordResetValidator, runValidation, passwordReset);

// logged in user
authRouter.route("/me").get(me);

module.exports = authRouter;
