/**
 * Legacy prototype logic (pre-refactor).
 *
 * Kept for reference/debugging while new modular pages replace older behavior.
<<<<<<< codex/expand-website-to-full-league-of-legends-build-tool-35c85b
 *
 * Legacy flow:
 * 1) `populateChamp` fills champion dropdown from Data Dragon.
 * 2) Selection handlers (`champSelect`, `levelSelect`, `abilitySelect`) recompute outputs.
 * 3) Tooltip helpers resolve stat/formula references for on-page ability text.
=======
>>>>>>> main
 */
//for debuging
var here="here";

var champData;
var level=1;
var aLevel=[1,1,1,1];

var HP=100;
var MP=100;
var AD=100;
var AD_Bonus = 100;
var MS=100;
var MS_Bonus_F = 0;
var MS_Bonus_P = 0;
var AR=100;
var MR=100;
var AP = 100;
var LS=100;
var AS=100;


var stats=[AP,AR,AD,AS];
var latestVersion;

<<<<<<< codex/expand-website-to-full-league-of-legends-build-tool-35c85b
/**
 * Loads latest patch champion list and fills the legacy champion selector.
 */
=======
>>>>>>> main
async function populateChamp(){
    // Fetch the list of versions
        const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await versionResponse.json();
        latestVersion = versions[0]; // The first element is the latest version

    
    
    var selector=document.getElementById("champList");
    champData = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`)
    .then(response => response.json())
    .then(data => data);
    
    for(const prop in champData.data){
        var output=`${prop}:${champData.data[prop]}`;
        var name=output.replace(":[object Object]","");
        selector.innerHTML=selector.innerHTML+'<option value="' + name + '">' + name + '</option>';
    }
}

<<<<<<< codex/expand-website-to-full-league-of-legends-build-tool-35c85b
/**
 * Reads the first scalar value from a referenced calculations entry.
 */
=======
>>>>>>> main
function getValueFromCalculations(calculations, reference) {
  const calculation = calculations[reference];

  if (!calculation || !calculation.mFormulaParts) {
    return null;
  }

  // Assuming the value is located in the first formula part
  const formulaPart = calculation.mFormulaParts[0];

  if (formulaPart && formulaPart.mValues) {
    // Assuming the value is located in the first value entry
    return formulaPart.mValues[0];
  }

  return null;
}

<<<<<<< codex/expand-website-to-full-league-of-legends-build-tool-35c85b
/**
 * Resolves legacy tooltip references and stat formula tokens to concrete values.
 */
=======
>>>>>>> main
function replaceReferences(tooltip, abilityValues, lowerCaseSpellCalculations, abilityNo) {
    function statLookup(part){

        switch(part.mStat){
            case 0:
                return AP;
            case 2:
                if(part.mStatFormula == 1){
                    return AD_Bonus;    //TODO This should be base AD?
                }
                    
                else if (part.mStatFormula == 2){
                    return AD;
                }
                else{
                    return AD+AD_Bonus;
                }
                    
            default:
                return AP;
        }
    }

  function calculateGameCalculation(gameCalculation, abilityLevel) {
      let value = 0;
      let varName;
      let dataValue;
      let stat = 0;
      if (gameCalculation.__type !== 'GameCalculation') {
        console.warn("Not a GameCalculation type");
        return 0;
      }

      for (let part of gameCalculation.mFormulaParts) {
        switch (part.__type) {
            case "NumberCalculationPart":
                value += part.mNumber;
                break;
            case "EffectValueCalculationPart":
                value += abilityValues.mEffectAmount[part.mEffectIndex - 1].value[abilityLevel];
                break;
            case "NamedDataValueCalculationPart":
                dataValue = abilityValues["mDataValues"].find(item => item.mName === part.mDataValue);
                value += dataValue.mValues[abilityLevel];
                break;
            case "StatByCoefficientCalculationPart":
                stat = statLookup(part);             //retrieves the relevant champion stat
                value += stat*Math.round(part.mCoefficient*100)/100;

                break;
            case "StatByNamedDataValueCalculationPart":

                
                //find the correct stat
                if(part.mStat){
                    stat = statLookup(part);
                } else{
                    stat = AP;
                }
                //determin if key is hashed
                if(part.mDataValue.startsWith('{')){
                    let varMatch = part.mDataValue.substring(1,9);
                    
                    for(let mName of abilityValues.mDataValues){
                            if(hash32Custom(mName.mName) === varMatch){
                                varName = mName.mName;
                                break;
                        }
                    }
                    dataValue = abilityValues["mDataValues"].find(item => item.mName === varName);
                } else {
                    dataValue = abilityValues["mDataValues"].find(item => item.mName === part.mDataValue);
                }

                
                if (dataValue && dataValue.mValues) {
                    value += stat * Math.round(dataValue.mValues[abilityLevel]*100)/100;
                } else {
                    console.warn(`Unknown or undefined mDataValue: ${part.mDataValue}`);
                }
                break;
            case "ProductOfSubPartsCalculationPart" :

                if(part.mPart1.mDataValue && part.mPart2.mDataValue){
                    value = abilityValues["mDataValues"].find(item => item.mName === part.mPart1.mDataValue).mValues[abilityLevel]*abilityValues["mDataValues"].find(item => item.mName === part.mPart2.mDataValue).mValues[abilityLevel];
                } else if (part.mPart1.mDataValue){
                    value = abilityValues["mDataValues"].find(item => item.mName === part.mPart1.mDataValue).mValues[abilityLevel]
                } else if(part.mPart2.mDataValue){
                    value = abilityValues["mDataValues"].find(item => item.mName === part.mPart2.mDataValue).mValues[abilityLevel]
                }

                break;
            case "StatBySubPartCalculationPart":            //This should be implemented with recursion...TODO
                //find the correct stat
                if(part.mStat){
                    stat = statLookup(part);
                } else{
                    stat = AP;
                }
                switch (part.mSubpart.__type){
                    case "NamedDataValueCalculationPart":
                        
                        //determine if key is hashed
                        if(part.mSubpart.mDataValue.startsWith('{')){
                            let varMatch = part.mSubPart.mDataValue.substring(1,9);

                            for(let mName of abilityValues.mDataValues){
                                    if(hash32Custom(mName.mName) === varMatch){
                                        varName = mName.mName;
                                        break;
                                }
                            }
                            dataValue = abilityValues["mDataValues"].find(item => item.mName === varName);
                        } else {

                            dataValue = abilityValues["mDataValues"].find(item => item.mName === part.mSubpart.mDataValue);

                        }


                        if (dataValue && dataValue.mValues) {
                            value += stat * Math.round(dataValue.mValues[abilityLevel]*100)/100;
                        } else {
                            console.warn(`Unknown or undefined mDataValue: ${part.mSubPart.mDataValue}`);
                        }
                        break;
                    default:
                        console.warn(`Unknown calculation subpart type: ${part.mSubPart.__type}`);
                }
                break;

            default:
                console.warn(`Unknown calculation part type: ${part.__type}`);
                break;
        }
      }

      if (gameCalculation.mMultiplier) {
        //toDo
      }

      if (gameCalculation.mDisplayAsPercent) {
        value *= 100;
      }
      console.log(value);
      return value;
  }

//This function takes the full matched text and the variable name extracted from the matched text as an input and     
  function replaceVariable(match, variableName) {
    let value;
    let regex = /^e(\d+)$/;

      
      
    let lowCaseData = containsVariable(variableName, abilityValues.mDataValues)
    if (lowCaseData) {
        value = abilityValues["mDataValues"].find(item => item.mName === lowCaseData).mValues[aLevel[abilityNo]];
        
    }
    else if(regex.exec(variableName)){
        value = abilityValues.mEffectAmount[regex.exec(variableName)[1]-1].value[aLevel[abilityNo]];
    }
    else if (lowerCaseSpellCalculations && variableName in lowerCaseSpellCalculations) {
        value = calculateGameCalculation(lowerCaseSpellCalculations[variableName],aLevel[abilityNo]);// replace with actual ability level
    }
    else if(variableName === "spellmodifierdescriptionappend"){
        return "";
    }
    else {
        console.warn(`Unknown variable name: ${variableName}`);
        return match; // Return the original variable text
    }

    return value;
  }
    
  return tooltip.replace(/\{\{\s*(\w+)\s*\}\}/g, replaceVariable);              //Looks for tags within in tooltip and replaces them with the correct variables
}


<<<<<<< codex/expand-website-to-full-league-of-legends-build-tool-35c85b
/**
 * Legacy onchange handler that loads selected champion and refreshes page sections.
 */
=======
>>>>>>> main
function champSelect(){
    var selector=document.getElementById("champList");
    var img=document.getElementById("thumb")
    var hp=document.getElementById("hp")
    var mp=document.getElementById("mp")
    var ad=document.getElementById("ad")
    var ms=document.getElementById("ms")
    var ar=document.getElementById("ar")
    var mr=document.getElementById("mr")

    // Choose the champion you want to display
    const championName = selector.value;
//console.log(champData.data[selector.value]["stats"]);
    //champ stats
    HP=champData.data[selector.value]["stats"]["hp"]+(level-1)*champData.data[selector.value]["stats"]["hpperlevel"];
    MP=champData.data[selector.value]["stats"]["mp"]+(level-1)*champData.data[selector.value]["stats"]["mpperlevel"];
    AD=champData.data[selector.value]["stats"]["attackdamage"]+(level-1)*champData.data[selector.value]["stats"]["attackdamageperlevel"];
    MS=champData.data[selector.value]["stats"]["movespeed"];
    AR=champData.data[selector.value]["stats"]["armor"]+(level-1)*champData.data[selector.value]["stats"]["armorperlevel"];
    MR=champData.data[selector.value]["stats"]["spellblock"]+(level-1)*champData.data[selector.value]["stats"]["spellblockperlevel"];;
    hp.innerHTML=HP;
    mp.innerHTML=MP;
    ad.innerHTML=AD+AD_Bonus;
    ms.innerHTML=MS;
    ar.innerHTML=AR;
    mr.innerHTML=MR;
    img.src=`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${selector.value}.png`;
        
        
        //champ ability attibutes
        // Get a reference to the DOM elements we need to update
        const abilityIcons = document.querySelectorAll("#abilities img");
        const abilityTitles = document.querySelectorAll("#abilities .ability-title");
        const abilityDescriptions = document.querySelectorAll("#abilities .ability-description");
        const abilityStats = document.querySelectorAll("#abilities .ability-stats");


// Fetch the JSON data for the chosen champion
fetch(`http://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion/${championName}.json`)
  .then(response => response.json())
  .then(data => {
    // Get the ability data from the JSON object
    const abilities = data.data[championName].spells;
    const passive = data.data[championName].passive;

    // Loop through each ability and update the DOM elements
    abilities.forEach((ability, index) => {
      // Fetch the ability details from the Community Data Dragon
fetch(`https://raw.communitydragon.org/latest/game/data/characters/${championName.toLowerCase()}/${championName.toLowerCase()}.bin.json`)
.then(response => response.json())
.then(abilityData => {

    abilityIcons[index].src = `http://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/spell/${ability.id}.png`;
    abilityTitles[index].textContent = ability.name;

    const abilityValues = abilityData['Characters/'+championName+'/Spells/'+abilityData['Characters/'+championName+'/CharacterRecords/Root'].spellNames[index]].mSpell;

    const tempLowerCaseSpellCalcuations = [];

// Check if the abilityValues object has a property named 'mSpellCalculations'
    if (abilityValues.mSpellCalculations) {

        // Convert the keys of mSpellCalculations to lowercase and store them in the array
        tempLowerCaseSpellCalcuations.push(Object.keys(abilityValues.mSpellCalculations).reduce((acc, key) => {
            // Convert each key to lowercase and assign its corresponding value from mSpellCalculations
            acc[key.toLowerCase()] = abilityValues.mSpellCalculations[key];
            // Return the accumulator for the next iteration
            return acc;
        }, {}));

        // Combine all objects in tempLowerCaseSpellCalcuations into a single object
        const lowerCaseSpellCalcuations = Object.assign({}, ...tempLowerCaseSpellCalcuations);

        // Update the innerHTML of the ability description at the given index using the replaceReferences function
        console.log(ability.tooltip);
        console.log(abilityValues);
        console.log(lowerCaseSpellCalcuations);
        abilityDescriptions[index].innerHTML = replaceReferences(ability.tooltip, abilityValues, lowerCaseSpellCalcuations, index);
    } 
    else {
        // If mSpellCalculations is not present, set the text content of the ability description
        // directly to the tooltip text without any modifications
        abilityDescriptions[index].textContent = ability.tooltip;
    }
        });
        
//Fills out the stats part of an ability such as cooldown, mana, range, etc
        abilityStats[index].innerHTML = `<li><strong>Cooldown:</strong> ${ability.cooldownBurn} seconds</li><li><strong>Mana cost:</strong> ${ability.costBurn}</li><li><strong>Range:</strong> ${ability.rangeBurn} units</li>`;
        
    });


    // Fetch the passive details from the Community Data Dragon
    fetch(`https://raw.communitydragon.org/latest/game/data/characters/${championName.toLowerCase()}/${championName.toLowerCase()}.bin.json`)
          .then(response => response.json())
          .then(passiveData => {

            abilityIcons[4].src = `http://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/passive/${passive.image.full}`;
            abilityTitles[4].textContent = passive.name;
            abilityDescriptions[4].innerHTML = passive.description;
          });


    });

}

<<<<<<< codex/expand-website-to-full-league-of-legends-build-tool-35c85b
/**
 * Legacy level-change handler that recomputes displayed stats/ability outputs.
 */
=======
>>>>>>> main
function levelSelect(){
    var levelSelector=document.getElementById("level");
    level=levelSelector.value;
    champSelect();
}

<<<<<<< codex/expand-website-to-full-league-of-legends-build-tool-35c85b
/**
 * Legacy ability-rank handler that recomputes tooltip values for each spell.
 */
=======
>>>>>>> main
function abilitySelect(){


    var abilityLevels = document.querySelectorAll("#abilities select");

    for(var i=0;i<4;i++){
        const abilityId = abilityLevels[i].id.split("-")[0]; // get the ability ID from the select element's ID
        const abilityLevel = parseInt(abilityLevels[i].value); // get the selected ability level as an integer
        switch (abilityId) {
          case "ability1":
            aLevel[0] = abilityLevel;
            break;
          case "ability2":
            aLevel[1] = abilityLevel;
            break;
          case "ability3":
            aLevel[2] = abilityLevel;
            break;
          case "ability4":
            aLevel[3] = abilityLevel;
            break;
          default:
            break;
        }
        champSelect();
      }
}

<<<<<<< codex/expand-website-to-full-league-of-legends-build-tool-35c85b
/**
 * Computes a deterministic 32-bit hash used by legacy lookup code paths.
 */
=======
>>>>>>> main
function hash32Custom(str) {
    const prime = BigInt(16777619);
    const offset = BigInt(2166136261);

    let hash = offset;
    
    for (let i = 0; i < str.length; i++) {
        hash = BigInt(hash);
        hash ^= BigInt(str.toLowerCase().charCodeAt(i));
        hash *= prime;
        hash = BigInt.asUintN(32, hash);
    }
    
    return hash.toString(16).padStart(8, "0");
}

<<<<<<< codex/expand-website-to-full-league-of-legends-build-tool-35c85b
/**
 * Checks whether an object-array contains an entry with the requested variable key.
 */
=======
>>>>>>> main
function containsVariable(variableName, objectArray) {


    // Iterate through the array
    for (var i = 0; i < objectArray.length; i++) {
        // Check if mName matches the variableName (case-insensitive)
        if (objectArray[i].mName === variableName) {
            return objectArray[i].mName;
        }
    }
    // Return false if the variableName was not found
    return false;
<<<<<<< codex/expand-website-to-full-league-of-legends-build-tool-35c85b
}
=======
}
>>>>>>> main
