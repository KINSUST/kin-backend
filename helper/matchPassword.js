const bcrypt = require("bcryptjs");
const createError = require("http-errors");

const matchPassword = (password, hashPassword) => {
  const isMatch = bcrypt.compareSync(password, hashPassword);

  if (!isMatch) {
    throw createError(400, "Wrong password");
  }
};

module.exports = matchPassword;
