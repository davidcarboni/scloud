const util = require('util');
const { spawn } = require('child_process');

// Based on: https://www.freecodecamp.org/news/node-js-child-processes-everything-you-need-to-know-e69498fe970a/
exports.handler = async (event, context) => {
    
    try {

        // Get the s3 key
        console.log(util.inspect(event))
        const s3Key = event['Records'][0]['s3']['object']['key']
        console.log(`s3 key is ${s3Key}`)


        // Process event
        const command = `Rscript -e "source('./R/process_script.R')" ${s3Key}`
        const child = spawn(command);
        stdout = ''
        stderr = ''

        child.on('exit', (code, signal) => {
            console.log(`Exit code ${code}, signal ${signal}`);

            // Respond with outcome
            if (code == 0) {
                return {
                    statusCode: 200,
                    headers: {},
                    body: stdout,
                  };
            } else {
                throw new error(stderr)
            }
        })

        child.on('error', () => {
            throw new error("Unable to start process.")
        })

        child.stdout.on('data', (data) => {
            console.log(data);
            stdout+=data
        });
          
        child.stderr.on('data', (data) => {
            console.log(data);
            stderr+=data
        });

        const { stdout, stderr } = await exec(command)

    } catch (err) {
        body = `Error: ${err.message}\nerr.stack`;
        console.log(body)
        return {
          statusCode: 500,
          headers: {},
          body,
        };
    }

}

const event = { Records: [{ s3: { object: { key: 'test.txt' } } }] };
exports.handler(event, "")