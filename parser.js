const fs = require('fs');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const xmlBuilder = require('xmlbuilder');
const { v4: uuidv4 } = require('uuid');

// Define TestCaseResultDto
class TestCaseResultDto {
    constructor(methodName, methodType, actualScore, earnedScore, status, isMandatory, errorMessage) {
        this.methodName = methodName;
        this.methodType = methodType;
        this.actualScore = actualScore;
        this.earnedScore = earnedScore;
        this.status = status;
        this.isMandatory = isMandatory;
        this.errorMessage = errorMessage;
    }
}

// Define TestResults
class TestResults {
    constructor() {
        this.testCaseResults = {};
        this.customData = '';
    }
}

// Function to delete output files if they exist
function deleteOutputFiles() {
    const outputFiles = [
        "./output_revised.txt",
        "./output_boundary_revised.txt",
        "./output_exception_revised.txt"
    ];

    outputFiles.forEach(file => {
        // Check if the file exists
        if (fs.existsSync(file)) {
            // Delete the file if it exists
            fs.unlinkSync(file);
            console.log(`Deleted: ${file}`);
        }
    });
}

// Function to check required HTML tags
function checkHtmlTags(htmlContent, requiredTags) {
    const dom = new JSDOM(htmlContent);
    const results = {};

    requiredTags.forEach(tag => {
        const tagFound = dom.window.document.getElementsByTagName(tag).length > 0;
        console.log(tag, " found result : ", tagFound);
        results[tag] = tagFound ? 'pass' : 'fail';
    });

    return results;
}

// Function to check if specific tags have given attribute and value
function checkHtmlAttributes(htmlContent, tagAttributePairs) {
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    const results = {};

    tagAttributePairs.forEach(({ tag, attribute, value }) => {
        const elements = document.getElementsByTagName(tag);
        let found = false;

        for (let i = 0; i < elements.length; i++) {
            const attrValue = elements[i].getAttribute(attribute);
            if (attrValue !== null) {
                if (value === undefined || attrValue === value) {
                    found = true;
                    break;
                }
            }
        }

        if (found) {
            console.log(`\x1b[33mTag <${tag}> with attribute "${attribute}"${value ? `="${value}"` : ''} found.\x1b[0m`);
            results[`${tag}[${attribute}${value ? `="${value}"` : ''}]`] = 'pass';
        } else {
            console.log(`\x1b[31mTag <${tag}> with attribute "${attribute}"${value ? `="${value}"` : ''} NOT found.\x1b[0m`);
            results[`${tag}[${attribute}${value ? `="${value}"` : ''}]`] = 'fail';
        }
    });

    return results;
}

function checkCssStyles(htmlContent, requiredStyles) {
    const dom = new JSDOM(htmlContent);
    const styleTags = dom.window.document.querySelectorAll('head > style');
    const results = {};

    if (styleTags.length > 0) {
        console.log('Found <style> tags in <head> section.');

        const cssContent = Array.from(styleTags).map(tag => tag.textContent).join(' ');

        requiredStyles.forEach(({ selector, properties }) => {
            // console.log(`Checking CSS for selector: ${selector}`);

            const regexSelector = new RegExp(`([^{}]*\\b${selector}\\b[^{}]*)\\s*{[^}]*}`, 'gi');
            const selectorMatch = regexSelector.exec(cssContent);

            if (selectorMatch) {
                console.log(`Selector "${selector}" found in CSS.`);
                const rules = selectorMatch[0];
                
                // Check all properties for the selector
                const allPropertiesPass = properties.every(({ key, value }) => {
                    // console.log(`Checking property "${key}" for selector "${selector}".`);
                    const regexProperty = new RegExp(`${key}\\s*:\\s*${value}`, 'gi'); // Match the property and its value
                    const propertyMatch = regexProperty.test(rules);
                    
                    if (propertyMatch) {
                        console.log(`\x1b[33mProperty "${key}" with value "${value}" found for selector "${selector}".\x1b[0m`);
                    } else {
                        console.log(`\x1b[31mProperty "${key}" with value "${value}" NOT found for selector "${selector}".\x1b[0m`);
                    }                    
                    
                    return propertyMatch; // Returns true only if the property matches
                });

                // Determine overall result for the selector
                results[selector] = allPropertiesPass ? 'pass' : 'fail';
            } else {
                console.log(`\x1b[31mSelector "${selector}" NOT found in CSS.\x1b[0m`);
                results[selector] = 'fail'; // Selector not found, mark as fail
            }
        });
    } else {
        console.log('\x1b[31mNo <style> tags found in <head> section.\x1b[0m');
        requiredStyles.forEach(({ selector }) => {
            console.log(`\x1b[31mNo CSS rules available for selector "${selector}". Marking as "fail".\x1b[0m`);
            results[selector] = 'fail'; // No styles, mark as fail for each selector
        });
    }

    console.log('Final results:', results);
    return results;
}

// Format results into the TestCaseResultDto structure
function formatTestResults(results, methodName, methodType) {
    const testCaseResult = new TestCaseResultDto(
        methodName,
        methodType,
        1,
        Object.values(results).includes('fail') ? 0 : 1, // If any result is 'fail', set score to 0
        Object.values(results).includes('fail') ? 'Failed' : 'Passed', // If any result is 'fail', set status to 'Failed'
        true, // Is Mandatory
        ''
    );    

    const testResults = new TestResults();
    const GUID = "218f52f6-d55f-477f-9c9e-a9c33b5d5df0";  // Generate a unique GUID for each test case
    testResults.testCaseResults[GUID] = testCaseResult;
    testResults.customData = 'Custom data goes here';  // Placeholder for custom data

    return testResults;
}

// Generate XML report (just like Angular code)
function generateXmlReport(result) {
    const xml = xmlBuilder.create('test-cases')
        .ele('case')
        .ele('test-case-type', result.status)
        .up()
        .ele('name', result.methodName)
        .up()
        .ele('status', result.status)
        .up()
        .end({ pretty: true });
    return xml;
}

// Function to write to output files
function writeOutputFiles(result, fileType) {
    let resultStatus = result.status === 'Passed' ? 'PASS' : 'FAIL';
    let output = `${result.methodName}=${resultStatus}\n`;

    const outputFiles = {
        functional: "./output_revised.txt",
        boundary: "./output_boundary_revised.txt",
        exception: "./output_exception_revised.txt",
        xml: "./yaksha-test-cases.xml"
    };

    // Choose the file based on the type
    let outputFilePath = outputFiles[fileType];
    if (outputFilePath) {
        fs.appendFileSync(outputFilePath, output);
    }
}

// Read the custom.ih file (similar to Angular code)
function readCustomFile() {
    let customData = '';
    try {
        customData = fs.readFileSync('../custom.ih', 'utf8');
    } catch (err) {
        console.error('Error reading custom.ih file:', err);
    }
    return customData;
}

// Dynamic function to handle the test case execution
async function handleTestCase(filePath, testCaseName, testCaseType, testLogic, extraParams = {}) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');

        // Read custom.ih file content
        const customData = readCustomFile();

        // Execute the test logic based on test case type
        const results = testLogic(data, ...extraParams);
        
        // Format test results and attach custom data
        const testResults = formatTestResults(results, testCaseName, testCaseType);
        testResults.customData = customData;

        // console.log(`${testCaseType} Results:`, results);
        console.log(`Sending data as:`, testResults);
        
        // Send results to the server
        // const response = await axios.post('https://yaksha-prod-sbfn.azurewebsites.net/api/YakshaMFAEnqueue?code=jSTWTxtQ8kZgQ5FC0oLgoSgZG7UoU9Asnmxgp6hLLvYId/GW9ccoLw==', testResults, {
        const response = await axios.post('https://compiler.techademy.com/v1/mfa-results/push', testResults, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log(`${testCaseType} Test Case Server Response:`, response.data);

        // Generate XML report and save to file
        const xml = generateXmlReport(testResults.testCaseResults[Object.keys(testResults.testCaseResults)[0]]);
        fs.writeFileSync(`${testCaseType.toLowerCase().replace(' ', '-')}-test-report.xml`, xml);

        // Write to output files (functional, boundary, exception)
        writeOutputFiles(testResults.testCaseResults[Object.keys(testResults.testCaseResults)[0]], 'functional');
    } catch (error) {
        console.error(`Error executing ${testCaseType} test case:`, error);
    }
}

// File path for the HTML file to check
const filePath = 'index.html';

// Define test cases
const htmlTagsTestCase = {
    testCaseName: 'HTML Tags Test',
    testCaseType: 'boundary',
    testLogic: checkHtmlTags,
    extraParams: [['html', 'body', 'title', 'h1', 'p']]
};

const requiredStyles = [
    {
        selector: 'h1',
        properties: [
            { key: 'text-align', value: 'center' },
        ]
    }
];

const cssTestCase = {
    testCaseName: 'CSS h1 Styles Test',
    testCaseType: 'boundary',
    testLogic: checkCssStyles,
    extraParams: [requiredStyles]
};

const requiredStyles2 = [
    {
        selector: 'p',
        properties: [
            { key: 'text-align', value: 'justify' },
            { key: 'line-height', value: 1.6 },
            { key: 'letter-spacing', value: '2px' }
        ]
    }
];

const cssTestCase2 = {
    testCaseName: 'CSS p Styles Test',
    testCaseType: 'boundary',
    testLogic: checkCssStyles,
    extraParams: [requiredStyles2]
};

function executeAllTestCases() {
    // Delete the output files before running the tests
    deleteOutputFiles();
    
    // Execute both test cases dynamically
    handleTestCase(filePath, htmlTagsTestCase.testCaseName, htmlTagsTestCase.testCaseType, htmlTagsTestCase.testLogic, htmlTagsTestCase.extraParams);
 
    // Execute the CSS styles test case
    handleTestCase(filePath, cssTestCase.testCaseName, cssTestCase.testCaseType, cssTestCase.testLogic, cssTestCase.extraParams);
    handleTestCase(filePath, cssTestCase2.testCaseName, cssTestCase2.testCaseType, cssTestCase2.testLogic, cssTestCase2.extraParams);
}

executeAllTestCases();
