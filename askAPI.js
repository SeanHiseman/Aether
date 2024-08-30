import 'dotenv/config';
import OpenAI from "openai";
const openai = new OpenAI();

const assistant = await openai.beta.assistants.create({
    name: "Ask",
    instructions: "Assist users",
    model: "gpt-4o-mini",
});

const thread = await openai.beta.threads.create();

const message = await openai.beta.threads.messages.create(
    thread.id,
    {
        role: "user",
        content: "Where is the world's tallest mountain?"
    }  
);

const run = await openai.beta.threads.runs.create(
    thread.id, 
    {
        assistant_id: assistant.id,
        instructions: "Your info:( Name: Ask, Site name: Aether) rules: (reply length < 3 sentences) "
    }
)

const checkStatusAndPrintMessages = async (threadId, runId) => {
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
    if (runStatus.status === "completed") {
        let messages = await openai.beta.threads.messages.list(threadId);
        messages.data.forEach((msg) => {
            const role = msg.role;
            const content = msg.content[0].text.value;
            console.log(`${role.charAt(0).toUpperCase() + role.slice(1)}: ${content}`);
        });
    } else {
        console.log("Run incomplete");
    }
};

setTimeout(() => {
    checkStatusAndPrintMessages(thread.id, run.id)
}, 10000);