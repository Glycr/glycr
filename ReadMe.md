backend/
├── server.js
├── app.js
├── config/
│   └── index.js
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── events.js
│   ├── tickets.js
│   ├── waitlists.js
│   ├── payouts.js
│   └── admin.js
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── eventController.js
│   ├── ticketController.js
│   ├── waitlistController.js
│   ├── payoutController.js
│   └── adminController.js
├── services/
│   ├── userService.js
│   ├── eventService.js
│   ├── ticketService.js
│   ├── waitlistService.js
│   ├── payoutService.js
│   └── emailService.js     (for future)
├── models/
│   └── index.js            (load/save JSON data)
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   └── validation.js
├── utils/
│   └── helpers.js
├── data/                   (JSON storage)
│   ├── users.json
│   ├── events.json
│   ├── tickets.json
│   ├── waitlists.json
│   └── payouts.json
├── uploads/                (event images)
└── logs/                   (activity logs)
