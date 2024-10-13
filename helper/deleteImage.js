

const fs = require("fs");
const asyncHandler = require("express-async-handler");

const deleteImage = asyncHandler(async (images) => {
    console.log(images);
  await fs.access(images);
  await fs.unlink(images);
  console.log("File removed");
});

module.exports = deleteImage;
