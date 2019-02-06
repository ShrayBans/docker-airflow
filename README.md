# docker-airflow

## NBA Question Answer Runner

How to run locally:

1. Make sure to have local redis and local postgres running
2. `node src/test/test-pbp-game-runner.js` to send messages of a sample game placed at `./src/test/resources/warriors-lakers.json`
3. `node src/load_jobs/question_answer_runner.js` to receive messages from queue and answer questions associated with sent events
4. `node src/test/test-automated-question-creator.js` to create additional automated questions
