import dotenv from 'dotenv';

dotenv.config();

//Old URI config
// let MONGODB_URI = process.env.MONGODB_URI;
// const SECRET = process.env.SECRET;

let MONGODB_URI = "mongodb+srv://youngfence:Heba2002!@reeyaz.pongdh0.mongodb.net/?retryWrites=true&w=majority";
const SECRET = "Heba2002!";
const PORT = process.env.PORT || 3003;

if (!process.env.NODE_ENV || process.env.NODE_ENV === 'test') {
  MONGODB_URI = process.env.MONGODB_TEST_URI!;
}

export = {
  MONGODB_URI,
  SECRET,
  PORT,
};
