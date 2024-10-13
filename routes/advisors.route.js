const express = require("express");
const { allAdvisor, createAdvisor, findAdvisorById, updateAdvisorById, deleteAdvisorById, bulkCreateAdvisors, bulkDeleteAdvisors } = require("../controllers/advisor.controllers");
const { advisorMulter } = require("../utils/multer");
const { isLoggedIn } = require("../middlewares/verify");
const { authorization } = require("../middlewares/authorization");
const advisorRouter = express.Router();

advisorRouter
  .route("/")
  .get(allAdvisor)
  .post(
    isLoggedIn,
    authorization("admin", "superAdmin"),
    advisorMulter,
    createAdvisor
  );

 // bulk create advisors
advisorRouter.post("/bulk-create",isLoggedIn,authorization("admin",'superAdmin'), bulkCreateAdvisors); 

// bulk delete advisors
advisorRouter.delete('/bulk-delete',isLoggedIn,authorization('admin','superAdmin'),bulkDeleteAdvisors)

advisorRouter
  .route("/:id")
  .get(isLoggedIn, authorization("admin", "superAdmin"), findAdvisorById)
  .patch(
    isLoggedIn,
    authorization("admin", "superAdmin"),
    advisorMulter,
    updateAdvisorById
  )
  .delete(isLoggedIn, authorization("admin", "superAdmin"), deleteAdvisorById);

// export router
module.exports = advisorRouter;
