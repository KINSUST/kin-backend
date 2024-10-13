const createError = require("http-errors");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const createJWT = require("../helper/createJWT");
const User = require("../model/user.model");
const randomHashCode = require("../helper/randomHashCode");
const {
  successResponse,
  errorResponse,
} = require("../services/responseHandler");
const sendAccountVerifyMail = require("../utils/email/accountActivationMail");
const matchPassword = require("../helper/matchPassword");

/**
 *
 * @apiDescription    Create a new user account
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/auth/register
 * @apiAccess         public
 *
 * @apiBody           { name, email, password, gender }
 *
 * @apiSuccess        { success: true , message: active your account by verify email, data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 * @apiError          ( Conflict: 409 )       Already have an account.
 *
 */
const userRegister = asyncHandler(async (req, res) => {
  // get email
  const { email } = req.body;

  // check if user exist

  const isExist = await User.findOne({
    where: {
      email,
    },
  });

  if (isExist) throw createError(400, "Already have an account.Please login.");

  // random hash code
  const { code, hashCode } = randomHashCode(4);

  // create verify token
  const verifyToken = createJWT(
    { email, code: hashCode },
    process.env.JWT_VERIFY_SECRET_KEY,
    process.env.JWT_VERIFY_EXPIRE
  );

  // create user
  let user = await User.create({
    ...req.body,
  });

  // prepare email data
  const emailData = {
    email,
    subject: "Account Activation Code.",
    code,
    verifyToken,
  };

  // send email
  await sendAccountVerifyMail(emailData);

  // cookie set
  res.cookie("verifyToken", verifyToken, {
    httpOnly: false,
    maxAge: 1000 * 60 * 5, // 5 min
    secure: true, // only https
    sameSite: "none",
  });
  // response send
  successResponse(res, {
    statusCode: 201,
    message: `Email has been sent to ${email}. Follow the instruction to activate your account`,
    payload: {
      data: user,
    },
  });
});

/**
 *
 * @apiDescription    Active user account by code
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/auth/activate
 * @apiAccess         registered user
 *
 * @apiBody           { code }
 *
 * @apiSuccess        { success: true , message: Successfully activated your account., data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 */
const activeUserAccountByCode = asyncHandler(async (req, res) => {
  const token = req.cookies.verifyToken;

  // check token
  if (!token) {
    throw createError(400, "Token not found");
  }

  // verify token
  jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decoded) => {
    if (err) {
      return errorResponse(res, {
        statusCode: 400,
        message: "Time expired! ",
      });
    }

    // check if user is already verified
    const user = await User.findOne({
      where: { email: decoded?.email },
    });

    // user exist check
    if (!user) {
      return errorResponse(res, {
        statusCode: 400,
        message: "Couldn't find any user account!. Please register.",
      });
    }

    if (user.isVerified === true) {
      return errorResponse(res, {
        statusCode: 400,
        message: "Your account is already active. Please login.",
      });
    }

    // check code
    const code = bcrypt.compareSync(req.body.code, decoded.code);

    if (!code) {
      return errorResponse(res, {
        statusCode: 400,
        message: "wrong code",
      });
    } else {
      await User.update(
        { isVerified: true },
        {
          where: { email: decoded.email },
        }
      );

      // cookie clear
      res?.clearCookie("verifyToken", {
        sameSite: "strict",
      });

      // response send
      return successResponse(res, {
        statusCode: 201,
        message: "Successfully activated your account.",
      });
    }
  });
});

/**
 *
 * @apiDescription    Resend verification code to email
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/auth/resend-active-code
 * @apiAccess         registered user
 *
 * @apiBody           { email}
 *
 * @apiSuccess        { success: true , message: Email has been sent to email. Follow the instruction to activate your account, data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 */
const resendActivationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({
    where: { email },
  });

  // check: user is exist or not.
  if (!user)
    throw createError(400, "Couldn't find any user account!. Please register.");

  // check: user is activate or not
  if (user.isVerified === true) {
    throw createError(400, "Your account is already active. Please login.");
  }

  // random hash code
  const { code, hashCode } = randomHashCode(4);

  // create verify token
  const verifyToken = createJWT(
    { email, code: hashCode },
    process.env.JWT_VERIFY_SECRET_KEY,
    process.env.JWT_VERIFY_EXPIRE
  );

  // prepare email data
  const emailData = {
    email,
    subject: "Account Activation Code",
    code,
    verifyToken,
  };

  // send email
  sendAccountVerifyMail(emailData);

  res.cookie("verifyToken", verifyToken, {
    httpOnly: true,
    maxAge: 1000 * 60 * 5, // 5 min
    secure: true, // only https
    sameSite: "none",
  });

  // response send
  successResponse(res, {
    statusCode: 200,
    message: `Email has been sent to ${email}. Follow the instruction to activate your account`,
  });
});

/**
 *
 * @apiDescription    User login
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/auth/login
 * @apiAccess         public
 *
 * @apiBody           { email, password }
 *
 * @apiDenied         { isBanned: true }
 *
 * @apiSuccess        { success: true , message: Successfully Login, data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( Not Found: 404 )      Couldn't find any user account!. Please register.
 *
 */
const userLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email) throw createError(400, "Please provide email");
  if (!password) throw createError(400, "Please provide password");

  // get user
  const user = await User.findOne({
    where: { email },
  });

  // user check
  if (!user)
    throw createError(400, "Couldn't find any user account!. Please register.");

  //  password match
  matchPassword(password, user.password);

  // isActivate check
  if (user.isVerified === false)
    throw createError(400, "Please active your account.");

  // isBanned check
  if (user.isBanned === true)
    throw createError(400, "You are banned. Please contact with authority");

  // create  access token
  const accessToken = createJWT(
    { email },
    process.env.JWT_LOGIN_SECRET_KEY,
    process.env.JWT_LOGIN_EXPIRE
  );

  // response send
  res.cookie("accessToken", accessToken, {
    httpOnly: false,
    maxAge: 1000 * 60 * 60 * 24 * 15, // 15 days
    secure: true, // only https
    sameSite: "none",
  });

  successResponse(res, {
    statusCode: 200,
    message: "Successfully Login to KIN.",
    payload: {
      data: { ...user.dataValues, accessToken },
    },
  });
});

/**
 *
 * @apiDescription    User Logout
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/auth/logout
 * @apiAccess         Only Logged in user
 *
 * @apiCookie         accessToken
 *
 * @apiSuccess        { success: true , message: Successfully Logout }
 * @apiFailed         { success: false , error: { status, message }
 *
 */
const userLogout = (req, res) => {
  res?.clearCookie("accessToken", {
    httpOnly: false,
    secure: true, // only https
    sameSite: "none",
  });

  // response send
  successResponse(res, {
    statusCode: 200,
    message: "Successfully Logout.",
  });
};

/**
 *
 * @apiDescription    Logged in user data
 * @apiMethod         GET
 *
 * @apiRoute          /api/v1/auth/me
 * @apiAccess         Only Logged in user
 *
 * @apiCookie         accessToken
 *
 * @apiSuccess        { success: true , message: Successfully Logout }
 * @apiFailed         { success: false , error: { status, message }
 *
 */
const me = asyncHandler(async (req, res) => {
  if (!req?.me) {
    return successResponse(res, {
      statusCode: 200,
      message: "User is not register.",
      payload: {
        data: null,
      },
    });
  }
  successResponse(res, {
    statusCode: 200,
    message: "Login User Data.",
    payload: {
      data: req.me,
    },
  });
});

/**
 *
 * @apiDescription    Dashboard Login
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/auth/dashboard-login
 * @apiAccess         Only Logged in user
 *
 * @apiCookie         accessToken
 *
 * @apiSuccess        { success: true , message: Successfully Login to KIN Dashboard. }
 * @apiFailed         { success: false , error: { status, message }
 *
 */

const dashboardLogin = asyncHandler(async (req, res) => {
  // get email and password
  const { email, password } = req.body;
  if (!email) throw createError(400, "Please provide email");
  if (!password) throw createError(400, "Please provide password");

  // get user
  const user = await User.findOne({ where: { email } });

  // if user not found
  if (!user) throw createError(400, "Couldn't find any admin account!.");

  if (!(user.role === "admin" || user.role === "superAdmin"))
    throw createError(400, "Please contact with authority.");

  //  password match
  matchPassword(password, user.password);

  // isActivate check
  if (user.isVerified === false)
    throw createError(400, "Please active your account.");

  // isBanned check
  if (user.isBanned === true)
    throw createError(400, "You are banned. Please contact with authority");

  // create  access token
  const accessToken = createJWT(
    { email },
    process.env.JWT_LOGIN_SECRET_KEY,
    process.env.JWT_LOGIN_EXPIRE
  );

  // response send
  res.cookie("accessToken", accessToken, {
    httpOnly: false,
    maxAge: 1000 * 60 * 60 * 24 * 15, // 15 days
    secure: true, // only https
    sameSite: "none",
  });

  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "Successfully Login to KIN Dashboard.",
    payload: {
      data: user,
    },
  });
});

module.exports = {
  userRegister,
  activeUserAccountByCode,
  resendActivationCode,
  userLogin,
  userLogout,
  dashboardLogin,
  me,
};

/**
 *
 * @apiDescription    Active user account
 * @apiMethod         GET
 *
 * @apiRoute          /api/v1/auth/activate/:token
 * @apiAccess         registered user
 *
 * @apiParam          { token }
 *
 * @apiSuccess        { success: true , message: Successfully activated your account., data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 */

const activeUserAccountByURL = asyncHandler(async (req, res) => {
  const token = req.params.token;
  // check token
  if (!token) {
    throw createError(400, "Invalid activation link");
  }

  // verify token
  jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, decoded) => {
    if (err) {
      errorResponse(res, {
        statusCode: 400,
        message: "Expired Token",
      });
    }

    // check if user is already verified
    const user = await User.findOne({
      where: { email: decoded.email },
    });

    if (user.isVerified === true) {
      errorResponse(res, {
        statusCode: 400,
        message: "Your account is already active. Please login.",
      });
    }

    // update user
    await User.update(
      { isVerified: true },
      {
        where: { email: decoded.email },
      }
    );

    // response send
    successResponse(res, {
      statusCode: 201,
      message: "Successfully activated your account.",
    });
  });
});

/**
 *
 * @apiDescription    Find account by email
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/auth/find-account
 * @apiAccess         registered user
 *
 * @apiBody           { email}
 *
 * @apiSuccess        { success: true , message: Email has been sent to email. Follow the instruction to activate your account, data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 */
const findAccount = asyncHandler(async (req, res) => {
  // get email
  const { email } = req.body;

  // find user by email
  const user = await User.findOne({
    where: { email },
  });

  // if user not found
  if (!user)
    throw createError(400, "Couldn't find any user account!. Please register.");

  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "User Found",
    Data: {
      email: user.email,
    },
  });
});

/**
 *
 * @apiDescription    Password reset request
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/auth/password-reset-request
 * @apiAccess         registered user
 *
 * @apiBody           { email}
 *
 * @apiSuccess        { success: true , message: Code sent to your email., data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 */

const passwordResetRequest = asyncHandler(async (req, res) => {
  // get email
  const { email } = req.body;

  // code generate
  const { code, hashCode } = randomHashCode(4);

  // create token
  const resetToken = createJWT(
    { email, code: hashCode },
    passwordResetKey,
    passwordResetExpire
  );

  // prepare email data
  const emailData = {
    email,
    subject: "Password Reset Code",
    code,
    resetToken,
  };

  // send email
  sendPasswordResetMail(emailData);

  // response
  res.cookie("resetToken", resetToken, {
    httpOnly: true,
    maxAge: 5 * 60 * 1000, // 5 minutes
    sameSite: "strict",
  });

  // response send
  successResponse(res, {
    statusCode: 200,
    message: `Code sent to your ${email}}`,
    payload: {
      email: email,
      code,
    },
  });
});

/**
 *
 * @apiDescription    Password reset
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/auth/password-reset
 * @apiAccess         registered user
 *
 * @apiBody           { email,password,code}
 *
 * @apiSuccess        { success: true , message: Successfully password updated., data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 */

const passwordReset = asyncHandler(async (req, res) => {
  // get password , code , email
  const { password, code, email } = req.body;

  // get resetToken
  const { resetToken } = req.cookies;

  // if password not found
  if (!password) throw createError(400, "Please provide password");

  // id code not found
  if (!code) throw createError(400, "Please provide code");

  // id resetToken not found
  if (!resetToken) throw createError(400, "Invalid request");

  jwt.verify(resetToken, passwordResetKey, async (err, decode) => {
    if (err) {
      return res.status(401).json({
        status: "Failed",
        message: "Code Expired!",
      });
    }

    // check code
    const isMatch = await bcrypt.compare(code, decode.code);
    if (!isMatch) {
      return errorResponse(res, {
        statusCode: 400,
        message: "Wrong Code",
      });
    }

    // update user
    const updateUser = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          password,
        },
      },
      { new: true }
    );

    // cookie clear
    res.clearCookie("resetToken", {
      sameSite: "strict",
    });

    // success response send
    successResponse(res, {
      statusCode: 200,
      message: "Successfully password updated.",
      payload: {
        data: updateUser,
      },
    });
  });
});
