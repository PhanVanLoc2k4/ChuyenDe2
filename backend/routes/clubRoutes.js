const express = require("express");
const router = express.Router();
const clubController = require("../controllers/clubController");

router.get("/", clubController.getAllClubs);
router.post("/", clubController.createClub);
router.put("/:id", clubController.updateClub);
router.get("/:id", clubController.getClubDetail);
router.get("/:id/members", clubController.getClubMembers);
router.get("/:id/requests", clubController.getClubRequests); // Mới
router.get("/:id/rankings", clubController.getClubRankings);
router.post("/join", clubController.joinClub);
router.post("/leave", clubController.leaveClub); // Mới
router.post("/requests/action", clubController.handleJoinRequest); 
router.delete("/:id", clubController.deleteClub); // Mới

module.exports = router;
