require('dotenv').config();
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");


        //*-----------|| All Api collection ||----------
        const sessionCollection = client.db("LearnHub").collection('sessions');
        const materialCollection = client.db("LearnHub").collection('materials');
        const userCollection = client.db("LearnHub").collection('users');
        const notesCollection = client.db("LearnHub").collection('notes');
        const paymentCollection = client.db("LearnHub").collection('payments');
        const bookedCollection = client.db("LearnHub").collection('bookedSession');


        //*-----------|| JWT Api ||----------
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '5h' });
            res.send({ token });
        })

        //*-----------|| Middleware ||----------
        const verifyToken = (req, res, next) => {
            // console.log('from verifyToken', req.headers);
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

         // !payment post method ||
         app.post('/sessionPayments', async(req, res)=>{
            const payment = req.body;
            console.log(payment);
            const result = await paymentCollection.insertOne(payment);
            console.log(result);
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

        //* ------------|| Session Api ||----------

        //! || Session post method ||
        app.post('/session', async (req, res) => {
            const session = req.body;
            const result = await sessionCollection.insertOne(session);
            res.send(result);
        })

        //! || Session get method ||
        app.get('/session', async (req, res) => {
            const result = await sessionCollection.find().toArray();
            res.send(result)
        })

        //! || Session get by id method ||
        app.get('/session/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await sessionCollection.findOne(query);
            res.send(result)
        })

        //! || Session get by email method ||
        app.get('/personalSession/:email', verifyToken, async (req, res) => {
            // console.log(req.headers);
            const email = req.params.email;
            const query = { tutorEmail: email };
            const result = await sessionCollection.find(query).toArray();
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
        //  app.get('/materials/:id', async(req, res)=>{
        //     const id = req.params.id;
        //     const query = {_id: new ObjectId(id)};
        //     console.log(query);
        //     const result = await materialCollection.findOne(query);
        //     console.log(result);
        //     res.send(result);
        //  })

        //  //! || material get by email and id method ||
        //  app.get('/materialItem/:email', async(req, res)=>{
        //     const email = req.params.email;
        //     const id = req.query.id;
        //     const query = {email: email, sessionId: id };
        //     const result = await materialCollection.findOne(query);
        //     res.send(result);
        //  })

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
            const result = await sessionCollection.deleteOne(query);
            res.send(result)
        })

        //* ------------|| Note Api ||----------
        // !note post method  || 
        app.post('/notes', async (req, res) => {
            const note = req.body;
            const result = await notesCollection.insertOne(note);
            res.send(result);
        })

        // !note get method  || 
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

        //* ------------|| Booked Api ||----------

        // !note get by id method  ||
        app.post('/bookedSession', async(req, res)=>{
            const booked = req.body;
            const email = req.query.email;
            const sessionId = req.query.id;
            const query = {email: email, sessionId: sessionId }
            const exist = await bookedCollection.findOne(query)
            if(exist){
                return res.status(400).send({message: "Already Booked"})
            }
            const result = await bookedCollection.insertOne(booked);
            res.send(result);
        })

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

