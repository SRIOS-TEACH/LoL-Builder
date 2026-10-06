// Native imports resolve the capability graph; no ordered global bootstrap or page APIs.
const path=require('node:path');
const root=process.env.APP_ROOT||path.join(__dirname,'../..');
module.exports={
 pipeline:require(path.join(root,'JS/engine/calculationPipeline.js')).default,
 combo:require(path.join(root,'JS/engine/comboEvaluation.js')).default,
 items:require(path.join(root,'JS/engine/itemEvaluation.js')).default,
 builds:require(path.join(root,'JS/domain/buildInputs.js')).default,
 source:require(path.join(root,'JS/data/championSource.js')).default,
};
