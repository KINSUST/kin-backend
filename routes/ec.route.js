const express = require("express");
const { getAllEc, addEc, findEcById, updateEcById, deleteEcById, memberDataUpdateById, removeMemberById, allEcMember, ecMemberTable, addMemberInEc } = require("../controllers/ec.controllers");
const { isLoggedIn } = require("../middlewares/verify");
const { authorization } = require("../middlewares/authorization");


const ecRouter = express.Router();

// routes
ecRouter
  .route("/")
  .get( getAllEc)   
  .post(
    isLoggedIn,
    authorization("admin", "superAdmin"),
    addEc
  );

  // member add in ec data  and update and remove
ecRouter  // ec committee id
  .post("/member-add-in-ec",
    isLoggedIn,
    authorization("admin", "superAdmin"),
    addMemberInEc
  );
 


ecRouter
  .route("/update-member/:id")  // member id
  .patch(
    isLoggedIn,
    authorization("admin", "superAdmin"),
    memberDataUpdateById
  );

ecRouter
  .route("/remove-member/:id") // member id
  .delete(isLoggedIn, authorization("admin", "superAdmin"), removeMemberById);



// ec data find by id and update and delete
ecRouter
  .route("/:id")
  .get( findEcById)
  .patch(isLoggedIn, authorization("admin", "superAdmin"), updateEcById)
  .delete(isLoggedIn, authorization("admin", "superAdmin"), deleteEcById);


  



// export
module.exports = ecRouter;
