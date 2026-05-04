const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");

router.get("/", postController.getAllPosts);
router.post("/", postController.createPost);
router.post("/like/:id", postController.likePost);
router.get("/:postId/comments", postController.getPostComments);
router.post("/:postId/comments", postController.createComment);
router.delete("/comments/:commentId", postController.deleteComment); // Mới
router.put("/:id", postController.updatePost); // Mới
router.delete("/:id", postController.deletePost); // Mới
router.post("/share", postController.createShare);

module.exports = router;
