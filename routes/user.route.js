const express = require("express");
const { isLoggedIn, isLoggedOut } = require("../middlewares/verify");
const { authorization } = require("../middlewares/authorization");
const {
  allUsers,
  addUser,
  findUserById,
  updateUserById,
  deleteUserById,
  updateUserPassword,
  forgotPassword,
  resetPasswordByCode,
  resendPasswordResetCode,
  resetPasswordByURL,
  banUserById,
  unbannedUserById,
  updateUserRole,
  bulkCreateUser,
} = require("../controllers/user.controllers");
const { userMulter } = require("../utils/multer");

const userRouter = express.Router();

// routes
userRouter
  .route("/")

  // all users
  .get(isLoggedIn, authorization("admin", "superAdmin"), allUsers)

  // add users
  .post(
    isLoggedIn,
    authorization("admin", "superAdmin"),
    addUser
  );

// update user password
userRouter.route("/password-update").patch(isLoggedIn,updateUserPassword);


// bulk create user
userRouter.post(
  "/bulk-create",
  isLoggedIn,
  authorization("superAdmin"),
  bulkCreateUser
);


// forgot password
userRouter
  .route("/forgot-password")
  .post(
    isLoggedOut,
     forgotPassword);

// reset password by code
userRouter
  .route("/reset-password")
  .post(
    isLoggedOut,
    resetPasswordByCode);

// resend password reset code
userRouter.route("/resend-password-reset-code").post(isLoggedOut,resendPasswordResetCode);

// reset password by URL ( link off)
// userRouter
//   .route("/reset-password/:token")
//   .patch(
//     isLoggedOut,
//     resetPasswordByURL);

// ban user by id
userRouter
  .route("/ban/:id")
  .patch(isLoggedIn, authorization("admin", "superAdmin"), banUserById);

// unbanned user by id
userRouter
  .route("/unban/:id")
  .patch(isLoggedIn, authorization("admin", "superAdmin"), unbannedUserById);

  // user role update
userRouter
  .route("/role-update/:id")
  .patch(isLoggedIn, authorization("superAdmin"), updateUserRole);

//   // update credential data
// userRouter
//   .route("/credential-update/:id")
//   .patch(isLoggedIn, authorization("superAdmin"), updateUserById);

// find user by id and update and delete
userRouter
  .route("/:id")
  .get(isLoggedIn,findUserById)
  .patch(isLoggedIn, userMulter, updateUserById)
  .delete(isLoggedIn, deleteUserById);

// export
module.exports = userRouter;
