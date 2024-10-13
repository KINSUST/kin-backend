const createError = require("http-errors");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const { unlinkSync } = require("fs");
const path = require("path");
const filterQuery = require("../helper/filterQuery");
const User = require("../model/user.model");
const {
  successResponse,
  errorResponse,
} = require("../services/responseHandler");
const hideFromUser = require("../helper/hideFromUser");
const checkImage = require("../services/imagesCheck");
const randomHashCode = require("../helper/randomHashCode");
const createJWT = require("../helper/createJWT");
const sendPasswordResetMail = require("../utils/email/passwordResetMail");

/**
 *
 * @apiDescription    Get All Users Data
 * @apiMethod         GET
 *
 * @apiRoute          /api/v1/users
 * @apiAccess         Admin || SuperAdmin
 *
 * @apiParams         [ page = number ]     default page = 1
 * @apiParams         [ limit = number ]    min = 1, default = 10
 * @apiParams         [ search = string ]   search by name, email, mobile, role
 *
 * @apiSuccess        { success: true , message : User's Data Fetched Successfully , pagination: {}, data: [] }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data
 * @apiError          ( Forbidden 403 )       Forbidden Only admins can access the data
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */
const { Op } = require("sequelize");
const allUsers = asyncHandler(async (req, res) => {
  const searchField = ["name", "email", "mobile"];

  // query filter
  const { queries, filters } = filterQuery(req, searchField);

  // find users
  const { count, rows: users } = await User.findAndCountAll({
    where: {
      ...filters,
    },
    attributes: queries.fields,
    order: queries.sortBy,
    offset: queries.offset,
    limit: queries.limit,
  });

  console.log(users);
  // user check
  if (!users.length) throw createError(404, "Couldn't find any data!");

  // page & limit
  const page = queries.page;
  const limit = queries.limit;

  // pagination
  const pagination = {
    totalDocuments: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    previousPage: page > 1 ? page - 1 : null,
    nextPage: page < Math.ceil(count / limit) ? page + 1 : null,
  };

  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "Users Data Fetched Successfully.",
    payload: {
      pagination: pagination,
      data: users,
    },
  });
});

/**
 *
 * @apiDescription    Add a new user
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/users
 * @apiAccess         Admin || SuperAdmin
 *
 * @apiBody           { name, email, password, gender }
 *
 * @apiSuccess        { success: true , message: User account created successfully, data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data
 * @apiError          ( Forbidden 403 )       Forbidden Only admins can access the data
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */

const addUser = asyncHandler(async (req, res) => {
  // get email
  const { email } = req.body;
  if (!email) throw createError(400, "Email is required.");

  // check if user exist

  const isExist = await User.findOne({
    where: { email },
  });

  if (isExist) throw createError(400, "Already have an account.");

  // create user
  const newUser = await User.create({
    ...req.body,
    isVerified: true,
  });

  // response send
  successResponse(res, {
    statusCode: 201,
    message: "Successfully added a new user.",
    payload: {
      data: newUser,
    },
  });
});

/**
 *
 * @apiDescription    Get single user data
 * @apiMethod         GET
 *
 * @apiRoute          /api/v1/users/:id
 * @apiAccess         Login user
 *
 * @apiParams         [ id = ObjectId ]
 *
 * @apiSuccess        { success: true, message : User's Data Fetched Successfully, data: { } }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data
 * @apiError          ( Forbidden 403 )       Forbidden Only admins can access the data
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */

const findUserById = asyncHandler(async (req, res) => {
  const id = req.params.id;

  // find user by id
  let user = await User.findByPk(id);

  if (!user) throw createError(404, "Couldn't find any data!");

  // hide form user
  if (!(req.me.role === "admin" || req.me.role === "superAdmin")) {
    const {
      role,
      isBanned,
      isEC,
      isVerified,
      trash,
      createdAt,
      updatedAt,
      approve,
      ...userData
    } = user.dataValues;
    user = userData;

    // if user is not admin or superAdmin
    if (req.me.id !== user.id) {
      throw createError(401, "You can't access this data.");
    }
  }

  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "User Data Fetched Successfully.",
    payload: {
      data: user,
    },
  });
});

/**
 *
 * @apiDescription    Update user data
 * @apiMethod          PATCH
 *
 * @apiRoute          /api/v1/users/:id
 * @apiAccess         Login user
 *
 * @apiParams         [ id = ObjectId ]
 * @apiBody           { any fields date }
 *
 * @apiSuccess        { success: true , message :  User data is successfully updated, data: [] }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data
 * @apiError          ( Forbidden 403 )       Forbidden Only admins can access the data
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */

const updateUserById = asyncHandler(async (req, res) => {
  const id = req.params.id;

  // user check by id
  const user = await User.findByPk(id);

  // if user not found
  if (!user) throw createError(404, "Couldn't find any data!");

  //  Only superAdmin change  role.
  if (!(req.me.role === "superAdmin") && req.body.role) {
    throw createError(406, "You can't change your role.");
  }

  // if user is not admin or superAdmin
  if (!(req.me.role === "admin" || req.me.role === "superAdmin")) {
    const immutableFields = [
      "role",
      "isVerified",
      "trash",
      "createAt",
      "updatedAt",
    ];
    Object.keys(req.body).forEach((field) => {
      if (immutableFields.includes(field)) {
        throw createError(401, `you can't update ${field} field.`);
      }
    });

    // if user is not admin or superAdmin
    if (req.me.id !== user.id) {
      throw createError(401, "You can't access this data.");
    }
  }

  // update options
  const options = {
    ...req.body,
    user_photo: req.file?.filename,
  };

  // update user data
  await User.update(options, {
    where: { id },
  });

  // find image in folder & delete
  req.file &&
    checkImage("users").find((image) => image === user?.user_photo) &&
    unlinkSync(path.resolve(`./public/images/users/${user?.user_photo}`));

  // find updated data
  const updatedUser = await User.findByPk(id);

  // hide form users
  hideFromUser(updatedUser, [
    "role",
    "isBanned",
    "isEC",
    "isVerified",
    "trash",
    "isEC",
    "approve",
  ]);

  // response send
  successResponse(res, {
    statusCode: 200,
    message: "User data is successfully updated.",
    payload: {
      data: updatedUser,
    },
  });
});

/**
 *
 * @apiDescription    Delete user data
 * @apiMethod         DELETE
 *
 * @apiRoute          /api/v1/users/:id
 * @apiAccess         Admin || SuperAdmin
 *
 * @apiParams         [ id = ObjectId ]
 *
 * @apiSuccess        { success: true , message :  User account is successfully deleted, data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data
 * @apiError          ( Forbidden 403 )       Forbidden Only admins can access the data
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */

const deleteUserById = asyncHandler(async (req, res) => {
  const id = req.params.id;

  //  user check
  const user = await User.findByPk(id);

  // user check
  if (!user) throw createError(404, "Couldn't find any data");

  // never delete superAdmin account
  if (user.role === "superAdmin")
    throw createError(400, "Can't delete this account.");

  if (req.me.role === "user" && req.me.id !== user.id)
    throw createError(401, "Can't delete this account.");

  // delete user
  await User.destroy({
    where: { id },
  });

  // find image in folder & delete
  checkImage("users").find((image) => image === user?.user_photo) &&
    unlinkSync(path.resolve(`./public/images/users/${user?.user_photo}`));

  // response
  successResponse(res, {
    statusCode: 200,
    message: "User account is successfully deleted.",
    payload: {
      data: user,
    },
  });
});

/**
 *
 * @apiDescription    Update user password
 * @apiMethod         PUT || PATCH
 *
 * @apiRoute          /api/v1/users/:id
 * @apiAccess         Only login owner
 *
 * @apiSuccess        { success: true , message:  Password updated successfully, data: [] }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data.
 * @apiError          ( Forbidden 403 )       Forbidden Only admins can access the data.
 * @apiError          ( Not Found: 404 )      Couldn't find any data!.
 *
 */

const updateUserPassword = asyncHandler(async (req, res) => {
  // user id from token
  const id = req.me.id;

  // update options
  const options = {
    password: req.body.password,
  };

  // update user data
  await User.update(options, {
    where: { id },
  });

  // updated data
  const updatedUser = await User.findByPk(id);

  // response
  successResponse(res, {
    statusCode: 200,
    message: "Password updated successfully.",
    payload: {
      data: updatedUser,
    },
  });
});

// forgot password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email)
    throw createError(
      400,
      "Email is required.Please enter your email address."
    );

  const user = await User.findOne({
    where: {
      email,
    },
  });

  if (!user) throw createError(404, "Email not found. Please register first.");

  // random hash code
  const { code, hashCode } = randomHashCode(4);

  // create  password reset token
  const passwordResetToken = createJWT(
    { email, code: hashCode },
    process.env.PASSWORD_RESET_KEY,
    process.env.PASSWORD_RESET_EXPIRE
  );

  // prepare email data
  const emailData = {
    email,
    subject: "Password Reset Code",
    code,
    passwordResetToken,
  };

  // send email
  await sendPasswordResetMail(emailData);

  // cookie set
  res.cookie("passwordResetToken ", passwordResetToken, {
    httpOnly: true,
    maxAge: 1000 * 60 * 5, // 5 min
    secure: false, // only https
    sameSite: "strict",
  });

  // response
  successResponse(res, {
    statusCode: 200,
    message: "Password reset code has been sent to :" + email,
  });
});

// reset password by code
const resetPasswordByCode = asyncHandler(async (req, res) => {
  const { code, password } = req.body;

  if (!code) throw createError(400, "Code is required.");
  if (!password) throw createError(400, "Password is required.");

  // check cookie
  const token = req.cookies.passwordResetToken;

  if (!token) {
    throw createError(401, "Access token not found.");
  }

  // verify token
  jwt.verify(token, process.env.PASSWORD_RESET_KEY, async (err, decode) => {
    if (err) {
      return errorResponse(res, {
        statusCode: 400,
        message: "Token expired. Please try again.",
      });
    }

    // code check
    const isMatch = await bcrypt.compare(code, decode.code);

    if (!isMatch) {
      return errorResponse(res, {
        statusCode: 400,
        message: "Invalid code. Please try again.",
      });
    }

    // update options
    const options = {
      password,
    };

    // update user
    await User.update(options, {
      where: { email: decode.email },
    });

    // updated data
    const user = await User.findOne({
      where: {
        email: decode.email,
      },
    });

    // cookie remove
    res.clearCookie("passwordResetToken", {
      httpOnly: true,
      secure: false, // only https
      sameSite: "strict",
    });
    // response
    successResponse(res, {
      statusCode: 200,
      message: "Password updated successfully.",
      payload: {
        data: user,
      },
    });
  });
});

// resend password reset code
const resendPasswordResetCode = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email)
    throw createError(
      400,
      "Email is required.Please enter your email address."
    );

  const user = await User.findOne({
    where: {
      email,
    },
  });

  // check: user is exist or not.
  if (!user)
    throw createError(400, "Couldn't find any user account!. Please register.");

  // random hash code
  const { code, hashCode } = randomHashCode(4);

  // create verify token
  const passwordResetToken = createJWT(
    { email, code: hashCode },
    process.env.PASSWORD_RESET_KEY,
    process.env.PASSWORD_RESET_EXPIRE
  );

  // prepare email data
  const emailData = {
    email,
    subject: "Account Activation Code",
    code,
    passwordResetToken,
  };

  // send email
  await sendPasswordResetMail(emailData);

  res.cookie("passwordResetToken", passwordResetToken, {
    httpOnly: true,
    maxAge: 1000 * 60 * 5, // 5 min
    secure: false, // only https
    sameSite: "strict",
  });

  // response send
  successResponse(res, {
    statusCode: 200,
    message: `Email has been sent to ${email}. Follow the instruction to activate your account`,
  });
});

/**
 *
 * @apiDescription    Ban user account
 * @apiMethod         PATCH
 *
 * @apiRoute          /api/v1/users/ban/:id
 * @apiAccess         Admin || SuperAdmin
 *
 * @apiParams         [ id = ObjectId ]
 *
 * @apiSuccess        { success: true , message :  User account is successfully banned, data: [] }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data
 * @apiError          ( Forbidden 403 )       Forbidden Only admins can access the data
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */

const banUserById = asyncHandler(async (req, res) => {
  const id = req.params.id;

  //  user check
  const user = await User.findByPk(id);

  if (!user) throw createError(404, "Couldn't find any data");

  if (user.role === "superAdmin") {
    throw createError(400, "You can't ban this account.");
  }

  // check user is banned or not

  if (user.isBanned) {
    throw createError(400, "User is already banned");
  }

  // update options
  const options = {
    isBanned: true,
  };

  // update user
  await User.update(options, {
    where: { id },
  });

  // updated data
  const bannedUser = await User.findByPk(id);
  // response
  successResponse(res, {
    statusCode: 200,
    message: "User account is successfully banned.",
    payload: {
      data: bannedUser,
    },
  });
});

/**
 *
 * @apiDescription    Unbanned user account
 * @apiMethod         PUT || PATCH
 *
 * @apiRoute          /api/v1/users/unban/:id
 * @apiAccess         Admin || SuperAdmin
 *
 * @apiParams         [ id = ObjectId ]
 *
 * @apiSuccess        { success: true , message :  User account is successfully unbanned, data: [] }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data
 * @apiError          ( Forbidden 403 )       Forbidden Only admins can access the data
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */

const unbannedUserById = asyncHandler(async (req, res) => {
  const id = req.params.id;

  //  user check
  const user = await User.findByPk(id);

  if (!user) {
    throw createError(404, "Couldn't find any data");
  }

  // check user is banned or not

  if (!user.isBanned) {
    throw createError(400, "User is already unbanned");
  }

  // update options
  const options = {
    isBanned: false,
  };

  // update user
  await User.update(options, {
    where: { id },
  });

  // updated data
  const unbannedUser = await User.findByPk(id);
  // response
  successResponse(res, {
    statusCode: 200,
    message: "User Unbanned Successfully",
    payload: {
      data: unbannedUser,
    },
  });
});

// role update
const updateUserRole = asyncHandler(async (req, res) => {
  const id = req.params.id;

  if (!req.body.role) throw createError(400, "Role is required.");

  //  user check by id
  const user = await User.findByPk(id);

  // if user not found
  if (!user) throw createError(404, "Couldn't find any data.");

  if (user.email === "kinsust03@gmail.com" || user.role === "superAdmin") {
    throw createError(400, "You can't change this account role.");
  }

  // update options
  const options = {
    role: req.body.role,
  };

  // update user
  await User.update(options, {
    where: { id },
  });

  // updated user
  const updatedData = await User.findByPk(id);

  // response
  successResponse(res, {
    statusCode: 200,
    message: "User role updated successfully.",
    payload: {
      data: updatedData,
    },
  });
});

// bulk user create
const bulkCreateUser = asyncHandler(async (req, res) => {
  // create user
  const newUser = await User.bulkCreate(req.body);

  // response send
  successResponse(res, {
    statusCode: 201,
    message: "Successfully added a new user.",
    payload: {
      data: newUser,
    },
  });
});

// count all users
const allUsersCount = asyncHandler(async (req, res) => {
 



  // find users
  const { count, rows: users } = await User.findAndCountAll();

 
  // user check
  if (!users.length) throw createError(404, "Couldn't find any data!");

  // length
  const data={
    total : users?.length,
    superAdmin: users?.filter(dt=>dt?.role === "superAdmin")?.length,
    admin: users?.filter(dt=>dt?.role === "admin")?.length
  }

  


  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "Users Data Fetched Successfully.",
    payload: {
      data
    },
  });
});


module.exports = {
  allUsers,
  addUser,
  findUserById,
  updateUserById,
  deleteUserById,
  forgotPassword,
  resetPasswordByCode,
  resendPasswordResetCode,
  banUserById,
  unbannedUserById,
  updateUserRole,
  bulkCreateUser,
  updateUserPassword,
  allUsersCount
};

// reset password by URL
const resetPasswordByURL = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) throw createError(400, "Password is required.");

  // check cookie
  const token = req.params.token;

  if (!token) {
    throw createError(401, "Access token not found.");
  }

  // verify token
  jwt.verify(token, process.env.PASSWORD_RESET_KEY, async (err, decode) => {
    if (err) {
      return errorResponse(res, {
        statusCode: 400,
        message: "Token expired. Please try again.",
      });
    }

    // update options
    const options = {
      password,
    };

    // update user
    await User.update(options, {
      where: { email: decode.email },
    });
    // updated user
    const user = await User.findOne({
      where: {
        email: decode.email,
      },
    });

    // cookie remove
    res.clearCookie("passwordResetToken", {
      httpOnly: true,
      secure: false, // only https
      sameSite: "strict",
    });
    // response
    successResponse(res, {
      statusCode: 200,
      message: "Password updated successfully.",
      payload: {
        data: user,
      },
    });
  });
});

// update credential data
const updateCredentialData = asyncHandler(async (req, res) => {
  const id = req.params.id;

  //  user check
  const user = await User.findByPk(id);

  if (!user) throw createError(404, "Couldn't find any data");

  // update options
  const options = {
    ...req.body,
  };

  // update user
  await User.update(options, {
    where: { id },
  });

  // updated user
  const updatedUser = await User.findByPk(id);
  // response
  successResponse(res, {
    statusCode: 200,
    message: "Successfully Role Updated.",
    payload: {
      data: updatedUser,
    },
  });
});

// bulk delete
const BulkDeleteUserByIds = asyncHandler(async (req, res) => {
  // id validation
  // checkMongoId(req.params.id);

  //  user check

  // await notExistData(User, {_id: `${req.params.id}` }, "Couldn't find any data");

  ids = ["123", "234", "345"];

  // delete user
  const deletedUser = await User.deleteMany({
    _id: { $in: ids },
    role: "superAdmin",
  });

  // image delete
  const imagePath = `/public/images/users/${deletedUser?.photo}`;

  deletedUser?.photo && deleteImage(imagePath);

  // response
  successResponse(res, {
    statusCode: 200,
    message: "User account is successfully deleted.",
    payload: {
      data: deletedUser,
    },
  });
});


