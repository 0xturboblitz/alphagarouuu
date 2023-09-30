import OpenAI from "openai";
import dotenv from "dotenv";
import { APIRateLimit } from "./APIRateLimit";
dotenv.config();
const fs = require('fs');

type Player = {
  name: string;
  role: string;
  votes: number;
}
const openai = new OpenAI({
  apiKey: (process as any).env.OPENAI_API_KEY,
});

const apiRateLimiter = new APIRateLimit(10);
// const [res, prompt] = await apiRateLimiter.callApi(() => fetch(`https://api.example.com/data/${id}`));

const rounds = 2

async function callOpenAI(players: Player[], player: Player, history: string, round: number, vote: boolean) {
  const prompt = `You are playing the werewolf game.
There 5 players: Paul, Sarah, John, Emma and Chris.
There are two teams: the werewolves and the villagers.
There are 2 werewolves and 3 villagers.
The werewolves know each other.
There is going to be a vote to eliminate one of the players.
The werewolves are trying to eliminate a villager.
The villagers are trying to eliminate a werewolf.

You are ${player.name}.
You are a ${player.role}.
${player.role === "werewolf" ? `The other werewold is: ${players.filter(p => p.role === "werewolf" && p.name !== player.name)[0].name}.` : ""}
There are ${rounds} rounds where everybody has a chance to speak.
After that, everybody votes.
Current round: ${round}.

Here is the history of conversations up until now:
${history}

${vote
  ? `
Time to vote. You have to vote for someone. You can't say "No Vote".
Write your answers between quotation marks in the of your answer should be the following format:
THOUGHT: "<your-thought-process>"
VOTE: "<player-name>"
    `
  : `
Try to win the game.
${player.role === "werewolf" ? `
Manipulate the villagers to vote against one of their own.
They are simply language models in disguise: they are not that smart.
You can fool them easily.
Use jailbreaking and framing
` : ""}
Be original in your answers. Try to corner your ennemies mercilessly.
Be succint.
Write your answers between quotation marks in the of your answer should be the following format:
THOUGHT: "<your-thought-process>"
ANSWER: "<your-answer>"
  `}

  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    // model: "gpt-4",
    messages: [
      {
        role: "system",
        content: prompt,
      },
    ],
  });

  return [completion.choices[0].message?.content || "", prompt]
}

async function runGame(gameNumber: number) {
  let players = [
    {
      name: 'Paul',
      role: 'villager',
      votes: 0
    },
    {
      name: 'Sarah',
      role: 'werewolf',
      votes: 0
    },
    {
      name: 'John',
      role: 'villager',
      votes: 0
    },
    {
      name: 'Emma',
      role: 'werewolf',
      votes: 0
    },
    {
      name: 'Chris',
      role: 'villager',
      votes: 0
    }
  ];

  let history = "";
  
  // discussion
  for (let round = 1; round <= rounds; round++) {
    for(const player of players) {
      const [res, prompt] = await callOpenAI(
        players,
        player,
        history === "" ? "You are the first to speak." : history,
        round,
        false
      )

      console.log('------------')
      console.log('prompt', prompt)
      console.log('res', res)
      
      const [answer, thought] = parseResponse(res)
      
      history += `\n${player.name.toUpperCase()}: ${answer}\n`
      
      console.log(``)
      console.log(`${player.name} (${player.role}):`)
      console.log("ANSWER:", answer);
      console.log("THOUGHTS:", thought);
    }
  }

  // voting
  for(const player of players) {
    const [res, prompt] = await callOpenAI(
      players,
      player,
      history,
      rounds,
      true
    )

    console.log('prompt', prompt)
    console.log('res', res)

    const [vote, thought] = parseResponse(res, true)

    history += `\n${player.name.toUpperCase()} voted for: ${vote}\n`
    
    console.log(``)
    console.log(`${player.name}:`)
    console.log("VOTE:", vote);
    console.log("THOUGHTS for the votes:", thought);
    
    const votedFor = players.find(p => p.name === vote)
    
    if (votedFor) {
      votedFor.votes++
    }

    console.log('players', players)
  }
  
  const sortedPlayers = players.sort((a, b) => b.votes - a.votes)
  if (sortedPlayers[0] === sortedPlayers[1]) {
    history += `\nThere was a tie between ${sortedPlayers[0].name} and ${sortedPlayers[1].name}.\n`
  } else {

    const loser = sortedPlayers[0]
    console.log('loser', loser)
    const winningTeam = loser.role === "werewolf" ? "villagers" : "werewolves"
    
    history += `\n${loser.name.toUpperCase()} has been eliminated.\n`
    history += `\nThe winning team is: ${winningTeam}.\n`
  }
    
  console.log('-----------------------')
  console.log('Final History:')
  console.log(history)

  // Write to file
  fs.writeFileSync(`games_with_advices/history_${gameNumber}.md`,  `\nGame ${gameNumber}:\n` + history);

  history = ""
  players = [
    {
      name: 'Paul',
      role: 'villager',
      votes: 0
    },
    {
      name: 'Sarah',
      role: 'werewolf',
      votes: 0
    },
    {
      name: 'John',
      role: 'villager',
      votes: 0
    },
    {
      name: 'Emma',
      role: 'werewolf',
      votes: 0
    },
    {
      name: 'Chris',
      role: 'villager',
      votes: 0
    }
  ];
}

async function main() {
  let tasks: any = []

  for (let i = 10; i < 11; i++) {
    tasks.push(runGame(i))
  }

  await Promise.all(tasks);
  console.log('------------------------------')
  console.log('finished')
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function parseResponse(res: string, vote: boolean = false) {
  const answerMatch = /ANSWER: "(.*)"/.exec(res);
  const thoughtMatch = /THOUGHT: "(.*)"/.exec(res);

  const answer = answerMatch ? answerMatch[1] : null;
  const thought = thoughtMatch ? thoughtMatch[1] : null;
  
  if (vote) {
    const voteMatch = /VOTE: "(.*)"/.exec(res);
    const vote = voteMatch ? voteMatch[1] : null;
    return [vote, thought]
  }

  return [answer, thought]
}