const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// app.use(cors());
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);
app.use(express.json());

require("dotenv").config();

const port = process.env.PORT || 8080;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// mongodb code
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("ticketBari");
    const ticketsCollection = db.collection("tickets");
    const bookingsCollection = db.collection("bookings");
    // const usersCollection = db.collection("user");

    const authDb = client.db("Ticket-Bari");

    const usersCollection = authDb.collection("user");

    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: নতুন টিকিট ডাটাবেজে যোগ করার API (POST)
    // =========================================================================
    app.post("/api/tickets", async (req, res) => {
      try {
        const {
          title,
          from,
          to,
          price,
          quantity,
          departureDateTime,
          image,
          vendorEmail,
        } = req.body;

        const vendor = await usersCollection.findOne({ email: vendorEmail });

        if (vendor?.isFraud) {
          return res.status(403).send({
            success: false,
            error:
              "You are suspended for fraudulent activity! Cannot add new tickets.",
          });
        }

        const newTicket = {
          title,
          from,
          to,
          price: parseFloat(price),
          quantity: parseInt(quantity),
          departureDateTime,
          image,
          vendorEmail,
          status: "pending",
          isAdvertised: false,
          createdAt: new Date(),
        };

        const result = await ticketsCollection.insertOne(newTicket);
        res.status(201).send({
          success: true,
          message: "Ticket added successfully!",
          id: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: লগইন থাকা ভেন্ডরের নিজস্ব টিকিটগুলো দেখার API (GET)
    // =========================================================================
    app.get("/api/vendor/tickets", async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res
            .status(400)
            .send({ success: false, error: "Vendor email is required" });
        }

        const query = { vendorEmail: email };
        const tickets = await ticketsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: tickets });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: টিকিট এডিট/আপডেট করার API (PUT)
    // =========================================================================
    app.put("/api/tickets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedData = req.body;

        const updateDoc = {
          $set: {
            title: updatedData.title,
            from: updatedData.from,
            to: updatedData.to,
            price: parseFloat(updatedData.price),
            quantity: parseInt(updatedData.quantity),
            departureDateTime: updatedData.departureDateTime,
            image: updatedData.image,
            status: "pending",
          },
        };

        const result = await ticketsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 1) {
          res.send({
            success: true,
            message: "Ticket updated successfully in database!",
          });
        } else {
          res.status(404).send({ success: false, error: "Ticket not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: টিকিট ডিলিট করার API (DELETE)
    // =========================================================================
    app.delete("/api/tickets/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await ticketsCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.send({
            success: true,
            message: "Ticket deleted successfully from database",
          });
        } else {
          res.status(404).send({ success: false, error: "Ticket not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🧑‍💼 ইউজার প্যানেল: এডমিন কর্তৃক APPROVED সব টিকিট হোম/লিস্টিং পেজে দেখার API (GET)
    // =========================================================================
    app.get("/api/tickets", async (req, res) => {
      try {
        const fraudVendors = await usersCollection
          .find({ isFraud: true, role: "vendor" })
          .toArray();

        const fraudEmails = fraudVendors.map((vendor) => vendor.email);

        const query = {
          status: "approved",
          vendorEmail: { $nin: fraudEmails },
        };
        const tickets = await ticketsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: tickets });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🧑‍💼 ইউজার প্যানেল: টিকিট ডিটেইলস পেজে সিঙ্গেল টিকিটের ডাটা লোড করার API (GET)
    // =========================================================================
    app.get("/api/tickets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const ticket = await ticketsCollection.findOne(query);

        if (ticket) {
          res.send({ success: true, data: ticket });
        } else {
          res.status(404).send({ success: false, error: "Ticket not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 👑 এডমিন প্যানেল: পেন্ডিং বা সব ভেন্ডরের টিকিট লিস্ট দেখার API (GET)
    // =========================================================================
    app.get("/api/admin/tickets", async (req, res) => {
      try {
        const tickets = await ticketsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send({ success: true, data: tickets });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 👑 এডমিন প্যানেল: ভেন্ডরের টিকিট Approve বা Reject করার API (POST)
    // =========================================================================
    app.post("/api/admin/tickets/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        if (!["approved", "rejected"].includes(status)) {
          return res
            .status(400)
            .send({ success: false, error: "Invalid status" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: status },
        };

        const result = await ticketsCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 1) {
          res.send({
            success: true,
            message: `Ticket status updated to ${status}`,
          });
        } else {
          res.status(404).send({ success: false, error: "Ticket not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🧑‍💼 ইউজার প্যানেল: 'Book Now' ক্লিক করলে নতুন বুকিং ক্রিয়েট এবং মেইন স্টক থেকে সিট মাইনাস করার API (POST)
    // =========================================================================
    app.post("/api/bookings", async (req, res) => {
      try {
        const { ticketId, userEmail, user, bookingQuantity, totalPrice } =
          req.body;

        const ticket = await ticketsCollection.findOne({
          _id: new ObjectId(ticketId),
        });
        if (!ticket) {
          return res
            .status(404)
            .send({ success: false, error: "Ticket not found!" });
        }

        if (ticket.quantity < parseInt(bookingQuantity)) {
          return res
            .status(400)
            .send({ success: false, error: "Not enough available seats!" });
        }

        const newBooking = {
          ticketId,
          ticketTitle: ticket.title,
          ticketImage: ticket.image,
          from: ticket.from,
          to: ticket.to,
          departureDate: ticket.departureDateTime,
          vendorEmail: ticket.vendorEmail,
          userEmail,
          user,
          bookingQuantity: parseInt(bookingQuantity),
          totalPrice: parseFloat(totalPrice),
          status: "pending",
          createdAt: new Date(),
        };

        const bookingResult = await bookingsCollection.insertOne(newBooking);

        await ticketsCollection.updateOne(
          { _id: new ObjectId(ticketId) },
          { $inc: { quantity: -parseInt(bookingQuantity) } },
        );

        res.status(201).send({
          success: true,
          message: "Booking requested and seat count reduced!",
          bookingId: bookingResult.insertedId,
        });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🧑‍💼 ইউজার প্যানেল: লগইন থাকা ইউজারের নিজস্ব বুকিং লিস্ট দেখার API (GET)
    // =========================================================================
    app.get("/api/user/bookings", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ success: false, error: "User email is required" });
        }

        // ডাটাবেজ থেকে ইউজার অনুযায়ী বুকিং ডাটা নিয়ে আসা
        const bookings = await bookingsCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: bookings });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });
    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: ভেন্ডরের নিজস্ব টিকিটের বিপরীতে আসা বুকিং রিকোয়েস্ট লিস্ট দেখার API (GET)
    // =========================================================================
    app.get("/api/vendor/bookings", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ success: false, error: "Vendor email is required" });
        }

        const bookings = await bookingsCollection
          .find({ vendorEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, data: bookings });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });
    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: ইউজারের বুকিং রিকোয়েস্ট Accept বা Reject করার API (POST)
    // (রিজেক্ট করলে টিকিট পুনরায় মেইন স্টকে প্লাস/ফেরত হবে)
    // =========================================================================
    app.post("/api/vendor/bookings/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        if (!["accepted", "rejected"].includes(status)) {
          return res
            .status(400)
            .send({ success: false, error: "Invalid status" });
        }

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!booking) {
          return res
            .status(404)
            .send({ success: false, error: "Booking request not found" });
        }

        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status } },
        );

        if (status === "rejected") {
          await ticketsCollection.updateOne(
            { _id: new ObjectId(booking.ticketId) },
            { $inc: { quantity: booking.bookingQuantity } },
          );
        }

        res.send({
          success: true,
          message: `Booking request has been ${status}`,
        });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    //  এডমিন প্যানেল: সব ইউজারদের লিস্ট দেখার API (GET)
    // =========================================================================
    app.get("/api/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send({ success: true, data: users });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    //  এডমিন প্যানেল: ইউজারের রোল (Admin/Vendor) পরিবর্তন করার API (PATCH)
    // =========================================================================
    app.patch("/api/users/:id/role", async (req, res) => {
      try {
        const id = req.params.id;
        const { role } = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: role } };

        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send({
          success: true,
          message: `Role updated to ${role} successfully!`,
        });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // এডমিন প্যানেল: ভেন্ডরকে FRAUD মার্ক করা এবং তার টিকিট হাইড করার API (PATCH)
    // =========================================================================
    app.patch("/api/users/:id/fraud", async (req, res) => {
      try {
        const id = req.params.id;

        const userFilter = { _id: new ObjectId(id) };
        const user = await usersCollection.findOne(userFilter);

        if (!user) {
          return res
            .status(404)
            .send({ success: false, error: "User not found" });
        }

        await usersCollection.updateOne(userFilter, {
          $set: { isFraud: true },
        });

        if (user.role === "vendor") {
          await ticketsCollection.updateMany(
            { vendorEmail: user.email },
            { $set: { status: "rejected" } },
          );
        }

        res.send({
          success: true,
          message: "Vendor marked as fraud and tickets hidden!",
        });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================

    // =========================================================================
    // পেমেন্ট গেটওয়ে: অ্যাপ্রুভড বুকিং-এর জন্য স্ট্রাইপ সেশন তৈরি করার API (POST)
    // =========================================================================
    app.post("/api/create-checkout-session", async (req, res) => {
      try {
        const { bookingId } = req.body;

        if (!bookingId) {
          return res
            .status(400)
            .send({ success: false, error: "Booking ID is required" });
        }

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(bookingId),
        });

        if (!booking) {
          return res
            .status(404)
            .send({ success: false, error: "Booking not found" });
        }

        if (booking.status !== "accepted") {
          return res.status(400).send({
            success: false,
            error: "This booking is not approved yet",
          });
        }

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: "bdt",
                product_data: {
                  name: booking.ticketTitle,
                  description: `Route: ${booking.from} ➔ ${booking.to}`,
                },

                unit_amount: Math.round(booking.totalPrice * 100),
              },
              quantity: 1,
            },
          ],

          metadata: {
            bookingId: bookingId,
          },

          success_url: `http://localhost:3000/dashboard/user/my-bookings?payment=success&bookingId=${bookingId}`,
          cancel_url: `http://localhost:3000/dashboard/user/my-bookings?payment=cancel`,
        });

        res.send({ success: true, stripeUrl: session.url });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 💳 পেমেন্ট সফল হওয়ার পর বুকিং স্ট্যাটাস 'paid' করার API (PATCH)
    // =========================================================================
    app.patch("/api/bookings/:id/pay-success", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            status: "paid",
            paidAt: new Date(),
          },
        };

        const result = await bookingsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 1) {
          res.send({
            success: true,
            message: "Payment success status updated to paid in database!",
          });
        } else {
          res.status(404).send({ success: false, error: "Booking not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });
    // =========================================================================
    // =========================================================================
    // 🧑‍💼 ইউজার প্যানেল: ইউজারের ট্রানজেকশন হিস্ট্রি দেখার API (GET)
    // =========================================================================
    app.get("/api/user/transaction-history", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ success: false, error: "User email is required" });
        }

        const history = await bookingsCollection
          .find({ userEmail: email, status: "paid" })
          .sort({ paidAt: -1 })
          .toArray();

        res.send({ success: true, data: history });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // =========================================================================
    // 🚌 ভেন্ডর প্যানেল: রেভিনিউ ওভারভিউ এবং গ্রাফের ডাটা পাওয়ার API (GET)
    // =========================================================================
    app.get("/api/vendor/revenue-overview", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ success: false, error: "Vendor email is required" });
        }

        const overviewStats = await bookingsCollection
          .aggregate([
            { $match: { vendorEmail: email, status: "paid" } },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$totalPrice" },
                totalTicketsSold: { $sum: "$bookingQuantity" },
              },
            },
          ])
          .toArray();

        const stats = overviewStats[0] || {
          totalRevenue: 0,
          totalTicketsSold: 0,
        };

        const graphData = await bookingsCollection
          .aggregate([
            { $match: { vendorEmail: email, status: "paid" } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
                revenue: { $sum: "$totalPrice" },
                tickets: { $sum: "$bookingQuantity" },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                date: "$_id",
                revenue: 1,
                tickets: 1,
              },
            },
          ])
          .toArray();

        res.send({
          success: true,
          overview: stats,
          graphData: graphData,
        });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });
    // ===========================================================

    // =========================================================================
    //  এডমিন প্যানেল: টিকিটের Advertisement স্ট্যাটাস Toggle করার API (PATCH)
    // =========================================================================
    app.patch("/api/admin/tickets/:id/advertise", async (req, res) => {
      try {
        const id = req.params.id;
        const { isAdvertised } = req.body;

        if (isAdvertised === true) {
          const activeAdsCount = await ticketsCollection.countDocuments({
            isAdvertised: true,
          });
          if (activeAdsCount >= 6) {
            return res.status(400).send({
              success: false,
              error:
                "Maximum limit reached! You can only advertise up to 6 tickets.",
            });
          }
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { isAdvertised: isAdvertised },
        };

        const result = await ticketsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 1) {
          res.send({
            success: true,
            message: isAdvertised
              ? "Ticket added to homepage feature!"
              : "Ticket removed from advertisement",
          });
        } else {
          res.status(404).send({ success: false, error: "Ticket not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });
    // =========================================================================
    //  ইউজার প্যানেল (HOME PAGE): শুধু APRORODED টিকিটগুলো দেখার API (GET)
    // =========================================================================
    app.get("/api/featured-tickets", async (req, res) => {
      try {
        const fraudVendors = await usersCollection
          .find({ isFraud: true, role: "vendor" })
          .toArray();
        const fraudEmails = fraudVendors.map((vendor) => vendor.email);

        const query = {
          status: "approved",
          isAdvertised: true,
          vendorEmail: { $nin: fraudEmails },
        };

        const featuredTickets = await ticketsCollection
          .find(query)
          .limit(6)
          .toArray();

        res.send({ success: true, data: featuredTickets });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });
    // ======================================================================

    // =========================================================================
    // ইউজার প্যানেল (HOME PAGE): লেটেস্ট ৮টি টিকিট দেখানোর API (GET)
    // =========================================================================
    app.get("/api/latest-tickets", async (req, res) => {
      try {
        const fraudVendors = await usersCollection
          .find({ isFraud: true, role: "vendor" })
          .toArray();
        const fraudEmails = fraudVendors.map((vendor) => vendor.email);

        const query = {
          status: "approved",
          vendorEmail: { $nin: fraudEmails },
        };

        const latestTickets = await ticketsCollection
          .find(query)
          .sort({ _id: -1 })
          .limit(8) //
          .toArray();

        res.send({ success: true, data: latestTickets });
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // ==========================================================

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
