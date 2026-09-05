// server.js
const express=require("express");
const cors=require("cors");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const fs=require("fs");
const crypto=require("crypto");

const app=express();

const PORT=process.env.PORT||3000;
const SECRET=process.env.JWT_SECRET||"SPACE_EMPIRE_CHANGE_THIS_SECRET";

app.use(cors({origin:true}));
app.use(express.json({limit:"2mb"}));

const DB="./data.json";

let db={
users:[]
};

if(fs.existsSync(DB)){
try{
db=JSON.parse(fs.readFileSync(DB,"utf8"));
}catch{}
}

function save(){
fs.writeFileSync(DB,JSON.stringify(db,null,2));
}

function auth(req,res,next){

try{

const header=req.headers.authorization||"";

if(!header.startsWith("Bearer "))
throw new Error();

req.user=jwt.verify(
header.substring(7),
SECRET
);

next();

}catch{

res.status(401).json({
error:"نشست شما معتبر نیست."
});

}

}

const PLANETS=[
"Nova Prime","Aurelia","Kronos","Elysium","Vanta",
"Helios","Titan","Orion","Kepler","Aether",
"Nereid","Gaia-X","Draconis","Vesper","Atlas",
"Zephyr","Prometheus","Luna-9","Cygnus","Erebus",
"Calypso","Artemis","Hyperion","Mirage","Polaris",
"Andromeda","Rhea","Solara","Nyx","Valhalla"
];

function choosePlanet(){

const counts=Array(30).fill(0);

for(const u of db.users){

if(u.state)
counts[u.state.planetId]++;

}

const min=Math.min(...counts);

const available=[];

counts.forEach((n,i)=>{

if(n===min)
available.push(i);

});

return available[
Math.floor(Math.random()*available.length)
];

}


function initialState(planetId){

return{

res:{
metal:1200,
crystal:650,
energy:500,
credits:3000
},

pop:12000,

score:0,

turn:1,

planetId,

planetName:PLANETS[planetId],

baseX:10+Math.floor(Math.random()*80),

baseY:10+Math.floor(Math.random()*80),

buildings:{
mine:1,
crystal:1,
reactor:1,
shipyard:1,
research:1,
radar:1
},

fleet:{
scout:2,
fighter:4,
cruiser:0,
carrier:0
},

research:{
mining:0,
reactor:0,
propulsion:0,
weapons:0,
sensor:0
},

discovered:[planetId],

logs:[
"فرماندهی آنلاین شد.",
"پایگاه اولیه با موفقیت مستقر شد."
],

battleLogs:[],

lastPresence:Date.now()

};

}


/* HEALTH */

app.get("/api/health",(req,res)=>{

res.json({
ok:true,
game:"Space Empire",
players:db.users.length
});

});


/* REGISTER */

app.post("/api/register",async(req,res)=>{

try{

const username=
String(req.body.username||"").trim();

const password=
String(req.body.password||"");

if(!/^[\p{L}\p{N}_-]{3,24}$/u.test(username)){

return res.status(400).json({
error:"نام کاربری باید ۳ تا ۲۴ کاراکتر باشد."
});

}

if(password.length<6){

return res.status(400).json({
error:"رمز عبور باید حداقل ۶ کاراکتر باشد."
});

}

if(
db.users.some(
u=>u.username.toLowerCase()===
username.toLowerCase()
)
){

return res.status(409).json({
error:"این نام کاربری قبلاً ثبت شده است."
});

}

const id=crypto.randomUUID();

const passwordHash=
await bcrypt.hash(password,12);

const planetId=choosePlanet();

const user={

id,

username,

password:passwordHash,

state:initialState(planetId),

online:true,

createdAt:Date.now()

};

db.users.push(user);

save();

const token=jwt.sign(
{
id,
username
},
SECRET,
{
expiresIn:"30d"
}
);

res.json({
token,
user:{
username
}
});

}catch(e){

res.status(500).json({
error:"خطا در ساخت حساب."
});

}

});


/* LOGIN */

app.post("/api/login",async(req,res)=>{

const username=
String(req.body.username||"").trim();

const password=
String(req.body.password||"");

const user=db.users.find(
u=>
u.username.toLowerCase()===
username.toLowerCase()
);

if(!user){

return res.status(401).json({
error:"نام کاربری یا رمز عبور اشتباه است."
});

}

const valid=
await bcrypt.compare(
password,
user.password
);

if(!valid){

return res.status(401).json({
error:"نام کاربری یا رمز عبور اشتباه است."
});

}

user.online=true;

save();

const token=jwt.sign(
{
id:user.id,
username:user.username
},
SECRET,
{
expiresIn:"30d"
}
);

res.json({
token,
user:{
username:user.username
}
});

});


/* ME */

app.get("/api/me",auth,(req,res)=>{

const user=db.users.find(
u=>u.id===req.user.id
);

if(!user){

return res.status(404).json({
error:"حساب پیدا نشد."
});

}

res.json({

user:{
username:user.username
},

state:user.state

});

});


/* SAVE */

app.put("/api/state",auth,(req,res)=>{

const user=db.users.find(
u=>u.id===req.user.id
);

if(!user){

return res.status(404).json({
error:"حساب پیدا نشد."
});

}

user.state=req.body.state;

save();

res.json({
ok:true
});

});


/* PRESENCE */

app.post("/api/presence",auth,(req,res)=>{

const user=db.users.find(
u=>u.id===req.user.id
);

if(!user){

return res.status(404).json({
error:"حساب پیدا نشد."
});

}

user.online=true;

user.state.lastPresence=Date.now();

save();

res.json({
ok:true
});

});


/* LOGOUT */

app.post("/api/logout",auth,(req,res)=>{

const user=db.users.find(
u=>u.id===req.user.id
);

if(user){

user.online=false;

save();

}

res.json({
ok:true
});

});


/* PLANET PLAYERS */

app.get("/api/planet/players",auth,(req,res)=>{

const me=db.users.find(
u=>u.id===req.user.id
);

if(!me){

return res.status(404).json({
error:"کاربر پیدا نشد."
});

}

/*
بازیکنانی که بیشتر از ۳۰ ثانیه
presence نفرستاده‌اند آفلاین محسوب می‌شوند.
*/

const now=Date.now();

const players=db.users
.filter(
u=>
u.state &&
u.state.planetId===
me.state.planetId
)
.map(u=>({

username:u.username,

baseX:u.state.baseX,

baseY:u.state.baseY,

online:
u.online &&
now-u.state.lastPresence<30000

}));

res.json({
players
});

});


/* AUTO OFFLINE */

setInterval(()=>{

const now=Date.now();

let changed=false;

for(const u of db.users){

if(
u.online &&
u.state &&
now-u.state.lastPresence>30000
){

u.online=false;

changed=true;

}

}

if(changed)
save();

},10000);


/* START */

app.listen(PORT,()=>{

console.log(
`SPACE EMPIRE SERVER RUNNING ON PORT ${PORT}`
);

});
