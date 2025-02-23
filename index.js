require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const app = express();
const port = process.env.PORT || 5000;

// middle ware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kriop.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");


        //*-----------|| All Api collection ||----------
        const sessionCollection = client.db("LearnHub").collection('sessions');
        const materialCollection = client.db("LearnHub").collection('materials');
        const userCollection = client.db("LearnHub").collection('users');
        const notesCollection = client.db("LearnHub").collection('notes');
        const paymentCollection = client.db("LearnHub").collection('payments');
        const bookedCollection = client.db("LearnHub").collection('bookedSession');
        const reviewCollection = client.db("LearnHub").collection('review');


        //*-----------|| JWT Api ||----------
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '5h' });
            res.send({ token });
        })

        //*-----------|| Middleware ||----------
        const verifyToken = (req, res, next) => {
            if (!req.headers?.authorization) {
                return res.status(401).send({ message: "unauthorize access" });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "unauthorized access" });
                }
                req.decoded = decoded;
                next();
            })
        }

        const verifyTutor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { tutorEmail: email }
            const user = await userCollection.findOne(query);
            const isTutor = user?.role === "Tutor"
            if (!isTutor) {
                return res.status(403).send({ message: "unauthorize access" });
            }
            next();
        }
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === "Admin"
            if (!isAdmin) {
                return res.status(403).send({ message: "unauthorize access" });
            }
            next();
        }

        //*-----------|| Payment Api ||----------

        // !create Payment Intent method
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            if (amount < 50) { // Stripe minimum for USD is $0.50
                return res.status(400).send({ message: "Amount must be at least $0.50" });
            }
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                "payment_method_types": ["card"],
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.get('/total-revenue', async (req, res) => {
            const totalRevenue = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$price" }
                    }
                }
            ]).toArray()
            const total = totalRevenue[0]?.total || 0;
            res.json({ total });
        })

        app.get('/total-revenue-by-month', async (req, res) => {
            const revenueByMonth = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m",
                                date: { $toDate: "$date" }
                            }
                        },
                        total: { $sum: "$price" }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]).toArray();
            res.json(revenueByMonth);
        })


        // !payment post method ||
        app.post('/sessionPayments', async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment);
            res.send(result);
        })

        app.get('/payment', async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result);
        })


        //* ------------|| User Api ||----------

        //! -------- || see which role user is method || -----
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user) {
                res.send({ role: user.role })
            }
        })

        //! || User get(All) and search method ||
        app.get('/users', async (req, res) => {
            // console.log(req.headers);
            const search = req.query.search;
            let query = {
                $or: [
                    {
                        name: {
                            $regex: search,
                            $options: 'i'
                        }
                    },
                    {
                        email: {
                            $regex: search,
                            $options: 'i'
                        }
                    },
                ]
            }
            const result = await userCollection.find(query).toArray();
            res.send(result);
        })

        //! || User post method ||
        app.post('/users', async (req, res) => {
            const userInfo = req.body;
            const email = req.query.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            if (user) {
                return res.send({ message: 'User exist' });
            }
            const result = await userCollection.insertOne(userInfo);
            res.send(result)
        })

        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id;
            const { role } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: role
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        //* ------------|| Session Api ||----------

        //! || Session post method ||
        app.post('/session', async (req, res) => {
            const session = req.body;
            const result = await sessionCollection.insertOne(session);
            res.send(result);
        })

        //! || Session get method ||
        app.get('/session', async (req, res) => {
            try {
                
                const { page = 0, limit = 8, sortBy = "default"} = req.query;
                const pageNumber = parseInt(page, 10);
                const limitNumber = parseInt(limit, 10);
                if (isNaN(pageNumber) || pageNumber < 0) {
                    return res.status(400).json({ error: "Invalid page value. Page must be a non-negative integer." });
                }
                if (isNaN(limitNumber) || limitNumber <= 0) {
                    return res.status(400).json({ error: "Invalid limit value. Limit must be a positive integer." });
                }
                let sort = {};
                if (sortBy === "price_asc") {
                    sort = { price: 1 };
                } else if (sortBy === "price_desc") {
                    sort = { price: -1 };
                } 
                const query = { status: "success" };
                const skip = pageNumber * limitNumber;
                const result = await sessionCollection
                    .find(query)
                    .sort(sort)  
                    .skip(skip) 
                    .limit(limitNumber)
                    .toArray();
                res.json(result);
            } catch (error) {
                console.error("Error fetching sessions:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });


        //! || Session get method  admin ||
        app.get('/sessionAdmin', async (req, res) => {
            const result = await sessionCollection.find().toArray();
            res.send(result);
        })

        //! || Session get by id method ||
        app.get('/session/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await sessionCollection.findOne(query);
            res.send(result)
        })

        //! || Session get by email method ||
        app.get('/personalSession/:email', async (req, res) => {
            const email = req.params.email;
            const query = { tutorEmail: email };
            const result = await sessionCollection.find(query).toArray();
            res.send(result)
        })
        app.get('/sessionCount', async (req, res) => {
            const query = { status: "success" };
            const count = await sessionCollection.countDocuments(query);
            res.send({ count });
        })

        // !admin
        app.patch('/session/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: status.status,
                    price: status.price || '0',
                    feedback: status.feedback || " "
                }
            }
            const options = { upsert: true };
            const result = await sessionCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })
        // !
        app.patch('/sessionReq/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: status.status,
                }
            }
            const options = { upsert: true };
            const result = await sessionCollection.updateOne(filter, updatedDoc, options)
            res.send(result)
        })


        //* ------------|| Material Api ||----------

        //! || material post method ||
        app.post('/materials', async (req, res) => {
            const material = req.body;
            const email = req.query.email;
            const id = req.query.id;
            const query = { email: email, sessionId: id };
            const existing = await materialCollection.findOne(query);
            if (existing) {
                return res.status(400).send({ message: "Card Already exist" })
            }
            const result = await materialCollection.insertOne(material);
            res.send(result);
        })

        //! || material get by id method ||
        app.get('/material/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await materialCollection.findOne(query);
            res.send(result);
        })

        //! || material get  method ||
        app.get('/allMaterial', async (req, res) => {
            const result = await materialCollection.find().toArray();
            res.send(result);
        })

        //! || material get by id method ||
        app.get('/materialStudent/:id', async (req, res) => {
            const id = req.params.id;
            const query = { sessionId: id };
            const result = await materialCollection.findOne(query);
            res.send(result);
        })

        //  //! || material get by email  method ||
        app.get('/materialItems/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await materialCollection.find(query).toArray();
            res.send(result);
        })

        //! || material patch id method ||
        app.patch('/materials/:id', async (req, res) => {
            const id = req.params.id;
            const material = req.body;
            const filter = { sessionId: id };
            const updateDoc = {
                $set: {
                    doc: material.doc,
                    image: material.image
                }
            }
            const result = await materialCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        //! || material delete method ||
        app.delete('/materials/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await materialCollection.deleteOne(query);
            res.send(result);
        })

        //! || material Admin delete method ||
        app.delete('/AdminMaterials/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await materialCollection.deleteOne(query);
            res.send(result);
        })

        //* ------------|| Note Api ||----------

        // !note post method  || 
        app.post('/notes', async (req, res) => {
            const note = req.body;
            const result = await notesCollection.insertOne(note);
            res.send(result);
        })

        // !note get method  || ---------------
        app.get('/notes/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await notesCollection.find(query).toArray();
            res.send(result);
        })

        // !note get by id method  ||
        app.get('/note/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await notesCollection.findOne(query);
            res.send(result);

        })

        // !note update ||
        app.patch('/notes/:id', async (req, res) => {
            const note = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = { $set: note };
            const result = await notesCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // !note delete ||
        app.delete('/notes/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await notesCollection.deleteOne(filter);
            res.send(result);
        })

        //* ------------|| Booked Api ||----------

        // !booked post (no duplicate) method  ||
        app.post('/bookedSession', async (req, res) => {
            const booked = req.body;
            const email = req.query.email;
            const sessionId = req.query.id;
            const query = { email: email, sessionId: sessionId }
            const exist = await bookedCollection.findOne(query)
            if (exist) {
                return res.status(400).send({ message: "Already Booked" })
            }
            const result = await bookedCollection.insertOne(booked);
            res.send(result);
        })

        // !booked get by email method  ||
        app.get('/bookedSession/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await bookedCollection.find(query).toArray();
            res.send(result)
        })

        //* ------------|| Review Api ||----------
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })

        app.get("/reviews", async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        });
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Go to Study please!!!!')
})

app.listen(port, () => {
    console.log(`server is running at port: ${port}`);
})

