var itemsData; //Globale variable to hold item data
var itemsTooltip;
//Lich Bane Has = 088f970047 - generatedtip_item_3100_tooltipinventoryextended


function findHash(str){
    var hash = XXH.h64(str,0);
    var truncHash = parseInt(hash._a32.toString(2).padStart(16, '0').substring(9,16),2).toString(16).padStart(2, '0');
    truncHash += hash._a16.toString(16).padStart(4, '0');
    truncHash += hash._a00.toString(16).padStart(4, '0');
    
    return(truncHash);
}

const maps = {
    summonersRift : 11,
    ARAM    :   12,
    areana  :   21,
    mapA    :   22,
    mapB    :   30
};


async function populateItems() {
    // Fetch the list of versions
    const versionResponse = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const versions = await versionResponse.json();
    latestVersion = versions[0]; // The first element is the latest version
    
    // Fetch item data from the League of Legends API
    const itemResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/item.json`);
    itemsData = await itemResponse.json();
    
        // Fetch tooltip from the League of Legends API
    const tooltipResponse = await fetch(`https://raw.communitydragon.org/latest/game/data/menu/main_en_us.stringtable.json`);
    itemsTooltip = await tooltipResponse.json();
    
        // Fetch tooltip data from the League of Legends API
    const tooltipDataResponse = await fetch(` https://raw.communitydragon.org/latest/game/items.cdtb.bin.json`);
    itemsTooltipData = await tooltipDataResponse.json();
   
    
    createTagCheckboxes();
    filterItems();
}

function displayItemDetails(itemId) {
    var itemStats;
    const tempLowerCaseItems = [];
    
    
    const item = itemsData.data[itemId];
    const tooltip = itemsTooltip["{"+findHash("generatedtip_item_3100_tooltipinventoryextended")+"}"];
    // Display the item's details in the UI
    document.getElementById("itemName").textContent = item.name;
    document.getElementById("itemDescription").innerHTML = item.description;
    document.getElementById("itemDescription").innerHTML += "<br><br>";
    
    
    itemStats= itemsTooltipData["Items/"+itemId];
    
    if(itemStats.mItemCalculations){
        // Convert the keys of mItemCalculations to lowercase and store them in the array
        tempLowerCaseItems.push(Object.keys(itemStats.mItemCalculations).reduce((acc, key) => {
            // Convert each key to lowercase and assign its corresponding value from mSpellCalculations
            acc[key.toLowerCase()] = itemStats.mItemCalculations[key];
            // Return the accumulator for the next iteration
            return acc;
        }, {}));

        // Combine all objects in tempLowerCaseSpellCalcuations into a single object
        const lowerCaseItems = Object.assign({}, ...tempLowerCaseItems);

        // Update the innerHTML of the ability description at the given index using the replaceReferences function
        console.log(itemsTooltip.entries["item_"+itemId+"_tooltip"]);
        console.log(item)       //TODO need to extract Stats
        console.log(itemStats);
        console.log(lowerCaseItems);
        
            document.getElementById("itemDescription").innerHTML += replaceReferences(itemsTooltip.entries["item_"+itemId+"_tooltip"],itemStats,lowerCaseItems);
    }
    

    
    
    

    // You can add more fields as needed, like item stats, cost, etc.
}

function createTagCheckboxes() {
    const uniqueTags = new Set();
    Object.values(itemsData.data).forEach(item => {
        item.tags.forEach(tag => uniqueTags.add(tag));
    });

    const filterContainer = document.getElementById("itemFilters");
    filterContainer.innerHTML = ''; // Clear existing filters

    uniqueTags.forEach(tag => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = tag;
        checkbox.name = tag;
        checkbox.value = tag;
        checkbox.onchange = filterItems; // Function to filter items based on selected tags

        const label = document.createElement("label");
        label.htmlFor = tag;
        label.textContent = tag;

        filterContainer.appendChild(checkbox);
        filterContainer.appendChild(label);
    });
}

function filterItems() {
    // Get selected tags
const selectedTags = Array.from(document.querySelectorAll('#itemFilters input[type="checkbox"]:checked')).map(checkbox => checkbox.value);

    // Clear and repopulate the item grid
    var itemGrid = document.getElementById("itemGrid");
    itemGrid.innerHTML = '';
    
    // Populate the grid with items
    for (const itemId in itemsData.data) {
        const item = itemsData.data[itemId];
        

        if(itemsData.data[itemId].gold["purchasable"] && itemsData.data[itemId].maps[maps.summonersRift] && !itemsData.data[itemId].requiredAlly){

            if (selectedTags.length === 0 || selectedTags.every(tag => item.tags.includes(tag))) {
                // Create an image element for each item
                var itemIcon = document.createElement("img");
                itemIcon.src = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/item/${itemId}.png`;
                itemIcon.alt = item.name;
                itemIcon.classList.add("item-icon"); // Add a class for styling
                itemIcon.onclick = function() { displayItemDetails(itemId); }; // Attach click event handler

                itemGrid.appendChild(itemIcon);
            }
        }
    }
}

function replaceReferences(tooltip, abilityValues, lowerCaseSpellCalculations) {
    function statLookup(part){
        switch(part.mStat){
            case 0:
                return AP;
            case 2:
                if(part.mStatFormula == 1){
                    
                    
                    return AD_Bonus;
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

  function calculateGameCalculation(gameCalculation) {
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
                value += abilityValues.mEffectAmount[part.mEffectIndex - 1].value;
                break;
            case "NamedDataValueCalculationPart":
                dataValue = abilityValues["mDataValues"].find(item => item.mName === part.mDataValue);
                value += dataValue.mValue;
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

                if (dataValue && dataValue.mValue) {
                    value += stat * Math.round(dataValue.mValue*100)/100;
                                    
                } else {
                    console.warn(`Unknown or undefined mDataValue: ${part.mDataValue}`);
                }

                break;
            case "ProductOfSubPartsCalculationPart" :

                if(part.mPart1.mDataValue && part.mPart2.mDataValue){
                    value = abilityValues["mDataValues"].find(item => item.mName === part.mPart1.mDataValue).mValue*abilityValues["mDataValues"].find(item => item.mName === part.mPart2.mDataValue).mValue;
                } else if (part.mPart1.mDataValue){
                    value = abilityValues["mDataValues"].find(item => item.mName === part.mPart1.mDataValue).mValue
                } else if(part.mPart2.mDataValue){
                    value = abilityValues["mDataValues"].find(item => item.mName === part.mPart2.mDataValue).mValue
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
                            value += stat * Math.round(dataValue.mValue*100)/100;
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
  function replaceVariable(match, variableName1, variableName2) {

      let value;
      let regex = /^e(\d+)$/;
      var variableName;

      if(variableName1)
        variableName=variableName1.toLowerCase();
      else
          variableName=variableName2.toLowerCase();

      
    let lowCaseData = containsVariable(variableName, abilityValues.mDataValues)
    if (lowCaseData) {

        value = abilityValues["mDataValues"].find(item => item.mName === lowCaseData).mValue;
        
    }
    else if(regex.exec(variableName)){
        value = abilityValues.mEffectAmount[regex.exec(variableName)[1]-1].value[aLevel[abilityNo]];
    }
    else if (lowerCaseSpellCalculations && variableName in lowerCaseSpellCalculations) {
        value = calculateGameCalculation(lowerCaseSpellCalculations[variableName]);// replace with actual ability level
    }
    else if(variableName === "spellmodifierdescriptionappend"){
        return "";
    }
    else {
        console.warn(`Unknown variable name: ${variableName}`);
        return match; // Return the original variable text
    }
      console.log(value)
    return value;
  }
    
  return tooltip.replace(/\{\{\s*(\w+)\s*\}\}|@(.*?)@/g, replaceVariable);              //Looks for tags within in tooltip and replaces them with the correct variables
}



// Call populateItems when the page loads
document.addEventListener("DOMContentLoaded", populateItems);