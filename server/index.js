const express = require('express');     
const passport = require('passport'); 
const helmet = require('helmet'); 
const validator = require('validator'); 
const bcrypt = require('bcrypt'); 
const bodyParser = require('body-parser'); 
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const jwtSecret = 'the-secret-isnt-very-good';
// use mongodb atlas so hosting database is not necessary
// allow to use webhost
const mongodb = require('mongodb'); 
const mongourl = "mongodb+srv://root:root@cluster0.zskqs.mongodb.net/myFirstDatabase?retryWrites=true&w=majority"; 
const mongoClient = new mongodb.MongoClient(mongourl, { useNewUrlParser: true, useUnifiedTopology: true });
const next = require('next'); 
const { useImperativeHandle } = require('react');

const app = express(); 
const passportOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret
}

// do basic authentication from jwt 
passport.use('jwt',new JwtStrategy(passportOptions, (payload, done) => {
    const database = app.locals.database; 
    database.collection('users').findOne({ _id: new mongodb.ObjectID(payload.userid) }, (err, doc) => {
        if(err) return done(err, false);
        if(doc) return done(null, doc);
        return done(null, false); 
    }); 
}));

app.use(bodyParser.json());
app.use(passport.initialize());

// register new account 
app.post('/user/register', async (request, response) => {
    // disallow if logged in 
    const { email, password } = request.body;
    if(!validator.isEmail(email)) 
        return response.send({ success: false, code: 'bad-email' }); 
    if(!password.length || password.length < 3 || password.length > 30) 
        return response.send({ success: false, code: 'bad-password' }); 
    const hash = bcrypt.hashSync(password, 10); 
    const database = app.locals.database;
    database.collection('users').findOne({ email }, (err, doc) => {
        if(err)
            return response.send({ success: false, code: 'server-error' }); 
        console.log('doc', doc);
        if(doc)
            return response.send({ success: false, code: 'user-exists' }); 
        database.collection('users').insertOne({ email, password: hash, staff: false, adoption_requests:[],adopted:[] }, (err) => {
            if(err)
                return response.send({ success: false, code: 'server-error' }); 
                
            database.collection('users').findOne({ email }, (err, doc) => {
                if(err)
                    return response.send({ success: false, code: 'server-error' }); 
                if(!doc)
                    return response.send({ success: false, code: 'server-error' }); 
                var token = jwt.sign({ userid: doc._id }, jwtSecret);
                return response.send({ success: true, token, staff: doc.staff })
            });
        });
    });
});

// Login account
app.post('/user/login', async (request, response) => {
    // disallow if logged in 
    const { email, password } = request.body;
    const database = app.locals.database;

    database.collection('users').findOne({ email }, (err, doc) => {
        if(err)
            return response.send({ success: false, code: 'server-error' })
        if(!doc)
            return response.send({ success: false, code: 'not-exists' });
        console.log('pass', password, 'doc', doc.password);
        if(!bcrypt.compareSync(password, doc.password))
            return response.send({ success: false, code: 'wrong-password' }); 
        var token = jwt.sign({ userid: doc._id }, jwtSecret);
        return response.send({ success: true, token, staff: doc.staff });
    });
});

// get list of adoptions 
app.get('/adoptions', passport.authenticate('jwt', { session: false }), async (request, response) => {
    var query = {}
    const database = app.locals.database;
    const adoptions = database.collection('animals'); 
    adoptions.find(query).sort({ _id: -1 }).toArray((err, results) => {
        if(err)
            return response.send({ success: false, code: 'server-error' });
            response.send({ success: true, data: results })
    }); ;
});

app.get('/requests', passport.authenticate('jwt', { session: false }), async (request, response) => {
    
    const database = app.locals.database;
    const adoption_requests = database.collection('adoption_requests'); 
    adoption_requests.find({ user: new mongodb.ObjectID(request.user._id) }).toArray((err, results) => {
        if(err)
            return response.send({ success: false, code: 'server-error'})
            return response.send({ success: true, data: results})
    });
});

app.get('/requests/pending', passport.authenticate('jwt', { session: false }), async (request, response) => {
    if(!request.user.staff) 
        return response.send({ success: false, code: 'not-authorized' });
    const database = app.locals.database;
    const adoption_requests = database.collection('adoption_requests'); 
    adoption_requests.find({ status: 'pending' }).toArray((err, results) => {
        if(err)
            return response.send({ success: false, code: 'server-error'})
            return response.send({ success: true, data: results})
    });
});

// user request adoption
app.post('/animals/:id/adopt', passport.authenticate('jwt', { session: false }), async (request, response) => {
    const { id } = request.params; 
    const database = app.locals.database;
    const adoption_requests = database.collection('adoption_requests'); 
    adoption_requests.findOne({ user: new mongodb.ObjectID(request.user._id ), animal: new mongodb.ObjectID(id) }, (err, doc) => {
        if(err)
            return response.send({ success: false, code: 'server-error' }); 
        if(doc)
            return response.send({ success: false, code: 'already-exists' }); 
        adoption_requests.insertOne({ user: new mongodb.ObjectID(request.user._id ), animal: new mongodb.ObjectID(id), status: 'pending' }, (err) => {

            if(err)
                return response.send({ success: false, code: 'server-error' }); 
            return response.send({ success: true });
        });
    });
});

// staff approve adoption request 
app.post('/adoptions/:id/approve', passport.authenticate('jwt', { session: false }), async (request, response) => {
    if(!request.user.staff) 
    return response.send({ success: false, code: 'not-authorized' });
    const { id } = request.params; 
    const database = app.locals.database;
    const adoption_requests = database.collection('adoption_requests'); 
    const users = database.collection('users'); 
    const animals = database.collection('animals'); 
    adoption_requests.findOne({ _id: new mongodb.ObjectID(id) }, (err, doc) => {
        if(err)
            return response.send({ success: false, code: 'server-error' }); 
        if(!doc)
            return response.send({ success: false, code: 'not-exists' }); 
        
        adoption_requests.update({ animal: new mongodb.ObjectID(doc.animal)}, { $set: { status: 'rejected' }}, (err) => {
            if(err)
            return response.send({ success: false, code: 'server-error' });      
            adoption_requests.updateOne({ _id: new mongodb.ObjectID(id) }, { $set: { status: 'approved' } }, (err, a, b) => {
                if(err)
                return response.send({ success: false, code: 'server-error' }); 
                animals.updateOne({ _id: new mongodb.ObjectID(doc.animal) }, { $set: { adopted_by: new mongodb.ObjectID(doc.user) } }, (err) => {
                    if(err)
                    return response.send({ success: false, code: 'server-error' }); 
                    users.updateOne({ _id: new mongodb.ObjectID(doc.user) }, { $push: { adopted: new mongodb.ObjectID(doc.animal) }}, (err) => {
                        if(err)
                        return response.send({ success: false, code: 'server-error' }); 
                        return response.send({ success: true });
                    }); 
                }); 
            });
        })

        
    });
});

// staff reject adoption request
app.post('/adoptions/:id/reject', passport.authenticate('jwt', { session: false }), async (request, response) => {
    if(!request.user.staff) 
    return response.send({ success: false, code: 'not-authorized' });
    const { id } = request.params; 
    const database = app.locals.database;
    const adoption_requests = database.collection('adoption_requests'); 
    adoption_requests.findOne({ _id: new mongodb.ObjectID(id) }, (err, doc) => {
        if(err)
            return response.send({ success: false, code: 'server-error' }); 
        if(!doc)
            return response.send({ success: false, code: 'not-exists' }); 
        
        adoption_requests.updateOne({ _id: new mongodb.ObjectID(id) }, { $set: { status: 'denied' } }, (err) => {
            if(err)
            return response.send({ success: false, code: 'server-error' }); 
            return response.send({ success: true });
        });
    });
});

// staff add new animal
app.post('/animals', passport.authenticate('jwt', { session: false }), async (request, response) => {
    if(!request.user.staff) 
    return response.send({ success: false, code: 'not-authorized' });
    console.log('a');
    const { name, type, dateOfBirth, description, pictures } = request.body; 
    if(!name || name.length < 3 || name.length > 15) 
        return response.send({ success: false, code: 'bad-name' });
    if(!type || type.length < 3) 
        return response.send({ success: false, code: 'bad-type' });
    if(!dateOfBirth)
        return response.send({ success: false, code: 'bad-date' });
    if(!description || description.length < 3)
        return response.send({ success: false, code: 'bad-description' });
    if(!pictures || !Array.isArray(pictures) || pictures.length == 0)
        return response.send({ success: false, code: 'bad-pictures'}); 
    console.log('b');
    
    const database = app.locals.database;
    const animals = database.collection('animals'); 
    animals.insertOne({ name, type, date_of_birth: dateOfBirth, description, pictures }, (err) => {
        if(err)
            return response.send({ success: false, code: 'server-error' })
        return response.send({ success: true });
    });
});

// staff list of animals, showing who owns each one (if adopted)
app.get('/animals', passport.authenticate('jwt', { session: false }), async (request, response) => {
    if(!request.user.staff) 
    return response.send({ success: false, code: 'not-authorized' });
    const database = app.locals.database;
    const animals = database.collection('animals'); 
    animals.find().toArray((err, results) => {
        if(err)
            return response.send({ success: false, code: 'server-error' }); 
        return response.send({ success: true, data: results }); 
    });
});


// Connect to database & start webserver
mongoClient.connect(async err => {
    if(err) 
        return console.error('failed to connect to database'); 
    app.locals.database = mongoClient.db("aas");  // aston-animal-sanctuary
    const napp = next({ dev: process.env.NODE_ENV !== "production" }); 
    await napp.prepare(); 
    app.all("*", (request, response) => napp.getRequestHandler()(request, response)); 
    app.listen(80, () => {
        console.log('App is listening on port 80');
    });
});