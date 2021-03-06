const express = require('express');
const models=require("../models");
const bcrypt = require('bcryptjs');
const ValidateRegistration=require("../validations/register");
const ValidateLogin = require("../validations/login");
const jwt = require('jsonwebtoken');
const keys=require ("../config/keys");
const nodemailer = require('nodemailer');

const transporter=nodemailer.createTransport(keys.smtpServerconfig);
const router = express.Router();




/*
    @route  api/register
    @desc  Registers users and encrypts their passwords for protection
    @inputs -> username,email,password,password2(confirmation password)
    @autogenerated inputs -> roles,id,timestamp
     @processes->Validation,Registration,Encryption,Build and save,Email Verification
    --&Validation->Validate User Inputs
    --&Registration->Save details
    --&Encryption->Encryptes password for protection
    --&Build &Save->Create a build version of the data and save it in the database to prevent data loss incase of failure
    --&Email Verification->Send an email to the user with a token for verification
    @access public
*/
router.post('/register', (req, res) => {
    //VALIDATION PROCESS
const{errors,isValid}=ValidateRegistration(req.body);

if (!isValid) {
    return res.status(400).json(errors)
} else {
    //REGISTRATION PROCESS
      models.User.findOne({
          where:{
              email:req.body.email
          }
       })
          .then(user => {
            if (user) {
               
                return res.status(400).json({email:"Email already exists"})
            }
            else{
              
                //ENCRYPTION PROCESS
                  bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(req.body.password, salt, (err, hash) => {
                      if (err) throw err;
                      req.body.password=hash
                      //BUILD AND SAVE PROCESS
                      models.User.build({
                        username:req.body.username,
                        email:req.body.email,
                        password:req.body.password,
                        temporarytoken:jwt.sign({email:req.body.email},
                            keys.secretOrKey,
                            { expiresIn: 3600// expires in 1 hr
                            })
                    }).save().then(success => {
                        
                           //EMAIL CONFIRMATION PROCESS
                           
                            
                            //Nodemailer Options
                            //Optional Attachments
                           
                            
                            var mailOptions = {
                                 from: '"Poll Team" <odessa98@ethereal.email>',
                                 to: req.body.email,
                                 subject: 'Account Verification',
                                 text: `Hey there,${req.body.username},please open the Link in the attachement to activate your account `,
                                
                                 attachments: [
                                    {
                                      filename: 'link.txt',
                                     content:`http://192.168.99.100/verify/${jwt.sign({email: req.body.email},
                                     keys.secretOrKey,
                                     { expiresIn: 3600// expires in 1hr
                                     }
                                     )}`
                                     
                                  
                                      
                                    }
                                ]
                               
                            }
                            
                            //Nodemailer SendMail
                            transporter.sendMail(mailOptions, (err, info) => {
                                 if (err) {
                                     console.log(err);
                                 } else {
                                     console.log('Email sent :' + info.response);
                                     res.json('Email sent :' + info.response)
                                 }
                             }) 
                        });
                   
                    })
                  
                  })
                
            }
          })
}
});
/*
    @route  api/auth/verify/token
    @desc Verify token to activate account
    @access private
*/
router.put('/verify/:token', (req, res) => {
 const token=req.params.token;
 jwt.verify(token,keys.secretOrKey,
    (error,decoded) => {
    if(decoded){
        const decoded=jwt.decode(token)
        
        models.User.update(
            { 
            verified:true,
            temporarytoken:"empty"
        },{
        where:{email:decoded.email}
        }
       )
       .then(() => {
         res.json({ message: 'Success' });
       })
            
       
        
   
    }
    else {
        const decoded=jwt.decode(token)
         models.User.destroy({
            where:{email:decoded.email}
         }) 
            
         return res.status(400).json({token:error})
            
            
        
    }
    
    }
    )

});
/*
    @route  api/login
    @desc Authenticate our users
    @processes->Validation,Authentication,Final
    --&Validation->Validate User Inputs
    --&Authentication->Verify details and whether user email is Verified
    --&Final->Grant the user a token if authenticated
    @access public
*/
router.post('/login', (req, res) => {
    //VALIDATION PROCESS
const{errors,isValid}=ValidateLogin(req.body);
const password=req.body.password

if(!isValid){
 return res.status(400).json( errors);
}
else{
    //AUTHENTICATION PROCESS
  models.User.findOne({
      where:{
          email:req.body.email
      }
   })
      .then(user => {
        if (!user) {
            return res.status(400).json({ email: 'Email not found' });
        } else if(user) {
          if(user.verified===false){
            return res.status(400).json({ email: 'Account has not been Verified' });
         
          }
          else{
              bcrypt.compare(password,user.password)
              .then((isMatch) => {
                  if (!isMatch) {
                      return res.status(400).json({ password: 'Incorrect Password' });
                  }
                  else{
                      //CREATE A TOKEN FOR OUR AUTHENTICATED USER(FINAL PROCESS)
                      const payload={
                          id:user.id,
                          username:user.username,
                          email:user.email,
                          role:user.role,
                          joined:user.createdAt
                      }
                      jwt.sign(
                          payload,
                          keys.secretOrKey,
                          {expiresIn:3600},
                          (err,token) => {
                          res.json({
                              success:true,
                              token: "Bearer " + token
                          })
                          }
                      )
                  }
              }).catch((err) => {
                return res.status(400).json({error:err });
              });
          }
                
        }
       
      })
}
});

module.exports = router;
