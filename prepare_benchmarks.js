var fs = require('fs');
var YAML = require('yaml');

const COMPLEXITY = YAML.parse(fs.readFileSync('./hyperparams.yml', 'utf8')).BENCH_TASK_COMPLEXITY;
const SEED = YAML.parse(fs.readFileSync('./hyperparams.yml', 'utf8')).SEED;
var seed = SEED;

var components = {}
var paths = []

//randomWithSeed
//- generates pseudo random numbers from an initial seed
function randomWithSeed() {
    seed++;
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

//getBPMNComponents
//- get all BPMN components
function getBPMNComponents(bpmn) {
    components = {};

    bpmn.nodes.forEach(node => {
        components[node.id] = {
            prerequisites: [],
            targets: [],
            himself: node
        }

        components[node.id].himself.payload.instructions = Math.round(randomWithSeed() * COMPLEXITY);
        components[node.id].himself.payload.in_bytes_count = Math.round(randomWithSeed() * COMPLEXITY);
        components[node.id].himself.payload.out_bytes_count = Math.round(randomWithSeed() * COMPLEXITY);
        components[node.id].himself.payload.dummy_padding = Math.round(randomWithSeed() * COMPLEXITY);
    })

    bpmn.links.forEach(link => {
        components[link.target].prerequisites.push(link.source);
        components[link.source].targets.push(link.target);
    });
}

//getBPMNPaths
//- get every possible path in the BPMN
function getBPMNPaths() {
    paths = [];
    var component = components["START"];
    getNextPath(component, 0, 0);
}

//getNextPath
//- recursive function which add a step to a path, and create alternative paths for each parallel gate in the bpmn
function getNextPath(c, idPath, idStep) {
    if(c.himself.type !== "parallelGateway") {
        if(!paths[idPath]) 
            paths[idPath] = [];
        if(!paths[idPath][idStep]) 
            paths[idPath][idStep] = [];
        if(!paths[idPath][idStep].includes(c.himself.id)) 
            paths[idPath][idStep].push(c.himself.id);

        if(c.himself.type == "exclusiveGateway") {
            var newPathId = idPath;

            c.targets.forEach(t => {
                paths[newPathId] = paths[idPath].slice(0, idStep + 1);
                getNextPath(components[t], newPathId, (idStep + 1));
                while(paths[newPathId] && paths[newPathId] !== []) newPathId++;
            })
        }
        else if(c.himself.type == "endEvent") {
            return;
        }
        else {
            c.targets.forEach(t => {
                getNextPath(components[t], idPath, (idStep + 1));
            })
        }
    }
    else {
        if(checkParallelGatePrerequisites(c, idPath)) {
            if(!paths[idPath][idStep]) 
                paths[idPath][idStep] = [];
            if(!paths[idPath][idStep].includes(c.himself.id)) 
                paths[idPath][idStep].push(c.himself.id);

            c.targets.forEach(t => {
                getNextPath(components[t], idPath, (idStep + 1));
            })
        }
    }
}

//checkParallelGatePrerequisites
//- verify that every step before a parallel gate is already positionned in the path before adding the parallel gate to the path 
function checkParallelGatePrerequisites(c, idPath) {
    for(var k = 0; k < c.prerequisites.length; k++) {
        prerequisite = c.prerequisites[k];
        found = false;

        for(var i = paths[idPath].length - 1; i > 0; i--) {
            if(paths[idPath][i].includes(prerequisite)) {
                found = true;
            }
        }
        if(!found) return false;
    }
    return true;
}

//getBPMNJson
//- get all BPMN json representation and stores it into a variable
function getBPMNJson() {
    var bpmns = [];
    var files = fs.readdirSync('./graphs');

    try {
        files.forEach(file => {
            bpmns.push([require('./graphs/' + file), file]);
        })    
    }
    catch(e) {
        console.log(e);
    }

    return bpmns;
}

////////////////////////////////////////

bpmns = getBPMNJson();

let dir="benchmarks";
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

bpmns.forEach(bpmn => {    
    getBPMNComponents(bpmn[0]);
    getBPMNPaths();
    
    try {
        var benchmark = {
            components: components,
            paths: paths
        }

        jsonB = JSON.stringify(benchmark);
        fs.writeFile('./benchmarks/bench_' + bpmn[1], jsonB, (err, result) => {
            if(err) console.log(err);
        }); 
    }
    catch(e) {
        console.log(e);
    }
})
