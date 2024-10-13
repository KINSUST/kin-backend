const express = require("express");
const {
  allPost,
  createPost,
  updatePostById,
  commentOnPostById,
  findPostBySlug,
  deletePostBySlug,
  deleteCommentOnPostById,
} = require("../controllers/post.controllers");
const { postMulter } = require("../utils/multer");
const { isLoggedIn } = require("../middlewares/verify");
const { authorization } = require("../middlewares/authorization");

const postRouter = express.Router();

postRouter
  .route("/")
  .get(allPost)
  .post(
    isLoggedIn,
    authorization("admin", "superAdmin"),
    postMulter,
    createPost
  );

// post on comment
postRouter.post("/comment-on-post", commentOnPostById);

// delete comment on post
postRouter.delete(
  "/delete-comment/:id",
  isLoggedIn,
  authorization("admin", "superAdmin"),
  deleteCommentOnPostById
);



postRouter
  .route("/:id")
  .patch(
    isLoggedIn,
    authorization("admin", "superAdmin"),
    postMulter,
    updatePostById
  );

postRouter
  .route("/:slug")
  .get(findPostBySlug)
  .delete(isLoggedIn, authorization("admin", "superAdmin"), deletePostBySlug);

module.exports = postRouter;
