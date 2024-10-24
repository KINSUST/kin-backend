const createError = require("http-errors");
const { unlinkSync } = require("fs");
const path = require("path");
const asyncHandler = require("express-async-handler");
const Advisor = require("../model/advisor.model");
const { successResponse } = require("../services/responseHandler");
const checkImage = require("../services/imagesCheck");
const filterQuery = require("../helper/filterQuery");

/**
 *
 * @apiDescription    Get All Advisors Data
 * @apiMethod         GET
 *
 * @apiRoute          /api/v1/advisors
 * @apiAccess         public
 *
 * @apiParams         [ page = number ]     default page = 1
 * @apiParams         [ limit = number ]    min = 1, default = 10
 * @apiParams         [ search = string ]   search by name, email, mobile
 *
 * @apiSuccess        { success: true , message : Advisors data fetched successfully. , pagination: {}, data: [] }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */

const allAdvisor = asyncHandler(async (req, res) => {
  const { filters, queries } = filterQuery(req);

  // find all advisor data
  const { count, rows: advisors } = await Advisor.findAndCountAll({
    where: {
      ...filters,
    },
    offset: queries.skip,
    limit: queries.limit,
    order: queries.sortBy, // sorting by index
    attributes: queries.fields, // specify the fields to display
  });

  // if advisor data not found
  if (!advisors.length) throw createError(400, "Couldn't find any data.");

  // page & limit
  const page = queries.page;
  const limit = queries.limit;

  // pagination object
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
    message: "Advisors data fetched successfully.",
    payload: {
      pagination,
      data: advisors,
    },
  });
});

/**
 *
 * @apiDescription    Create New Advisor Data
 * @apiMethod         POST
 *
 * @apiRoute          /api/v1/advisors
 * @apiAccess         admin / superAdmin
 *
 * @apiSuccess        { success: true , message : Advisor data created successfully. , data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data
 * @apiError          ( Forbidden 403 )       Forbidden Only admins/super-admin can access the data
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */
const createAdvisor = asyncHandler(async (req, res) => {
  if (!req.body.email) throw createError(404, "Email Is Required!");

  // advisor check is already register or not
  const existAdvisor = await Advisor.findOne({
    where: { email: req.body.email },
  });

  // // advisor email check
  if (existAdvisor) throw createError(404, "Email already exits!");

  // create advisor data
  const result = await Advisor.create({
    ...req.body,
    advisor_photo: req?.file?.filename,
  });

  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "Advisor data created successfully.",
    payload: {
      data: result,
    },
  });
});

/**
 *
 * @apiDescription    Get Single Advisor Data
 * @apiMethod         GET
 *
 * @apiRoute          /api/v1/advisors/:id
 * @apiAccess         public
 *
 * @apiSuccess        { success: true , message : Advisor data fetched successfully. , data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */

const findAdvisorById = asyncHandler(async (req, res, next) => {
  const id = req.params.id;

  // find advisor by id
  const advisor = await Advisor.findByPk(id);

  // if advisor data not found
  if (!advisor) throw createError(400, "Couldn't find any advisor data.");

  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "Advisor data fetched successfully.",
    payload: {
      data: advisor,
    },
  });
});

/**
 *
 * @apiDescription    Delete Single Advisor Data
 * @apiMethod         DELETE
 *
 * @apiRoute          /api/v1/advisor/:id
 * @apiAccess         admin / superAdmin
 *
 * @apiSuccess        { success: true , message : Advisor data deleted successfully. , data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data
 * @apiError          ( Forbidden 403 )       Forbidden Only admins can access the data
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */

const deleteAdvisorById = asyncHandler(async (req, res, next) => {
  const id = req.params.id;

  // find advisor by id
  const advisor = await Advisor.findByPk(id);

  // if advisor data not found
  if (!advisor) throw createError(400, "Couldn't find any advisor data.");

  // data  delete from database
  await Advisor.destroy({
    where: { id },
  });

  // find image in folder & delete
  checkImage("advisors").find((image) => image === advisor?.advisor_photo) &&
    unlinkSync(
      path.resolve(`./public/images/advisors/${advisor?.advisor_photo}`)
    );

  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "Advisor data deleted successfully.",
    payload: {
      data: advisor,
    },
  });
});

/**
 *
 * @apiDescription    Update Single Advisor Data
 * @apiMethod         PATCH
 *
 * @apiRoute          /api/v1/advisors/:id
 * @apiAccess         admin / superAdmin
 *
 * @apiSuccess        { success: true , message : Advisor data updated successfully. , data: {} }
 * @apiFailed         { success: false , error: { status, message }
 *
 * @apiError          ( Bad Request 400 )     Invalid syntax / parameters
 * @apiError          ( unauthorized 401 )    Unauthorized, Only authenticated users can access the data
 * @apiError          ( Forbidden 403 )       Forbidden Only admins can access the data
 * @apiError          ( Not Found: 404 )      Couldn't find any data!
 *
 */

const updateAdvisorById = asyncHandler(async (req, res) => {
  const id = req.params.id;

  // find advisor by id
  const advisorData = await Advisor.findByPk(id);

  // if advisor data not found
  if (!advisorData) throw createError(400, "Couldn't find any advisor data.");

  // update options
  const updateOptions = {
    ...req.body,
    advisor_photo: req?.file?.filename,
  };

  // update advisor data
  await Advisor.update(updateOptions, {
    where: { id },
    returning: true,
    plain: true,
  });
  // find image in folder & delete
  checkImage("advisors").find(
    (image) => image === advisorData?.advisor_photo
  ) &&
    unlinkSync(
      path.resolve(`./public/images/advisors/${advisorData?.advisor_photo}`)
    );

  // find updated data
  const advisor = await Advisor.findByPk(id);

  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "Advisor data updated successfully.",
    payload: {
      data: advisor,
    },
  });
});

/**
 * @method     POST
 * @route      /api/v1/advisors/bulk-create
 * @access     admin / superAdmin
 * @desc       Bulk create advisors
 *
 */

const bulkCreateAdvisors = asyncHandler(async (req, res) => {
  // get advisors array from req.body
  const advisors = req.body;

  // bulk create advisors
  const result = await Advisor.bulkCreate(advisors);

  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "Advisors data created successfully.",
    payload: {
      data: result,
    },
  });
});

/**
 * @method     DELETE
 * @route      /api/v1/advisors/bulk-delete
 * @access     admin / superAdmin
 * @desc       Bulk delete advisors
 *
 */

const bulkDeleteAdvisors = asyncHandler(async (req, res) => {

  const advisors = await Advisor.findAll();
  if (!advisors.length) throw createError(400, "Couldn't find any advisor data.");

  // bulk delete advisors
  await Advisor.destroy({ 
    where: {},
    truncate: true,  // empty the table 
  });

  // success response send
  successResponse(res, {
    statusCode: 200,
    message: "All Advisors data deleted successfully.",
  });
});

module.exports = {
  allAdvisor,
  createAdvisor,
  findAdvisorById,
  deleteAdvisorById,
  updateAdvisorById,
  bulkCreateAdvisors,
  bulkDeleteAdvisors,
};
