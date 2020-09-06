import TelegramBot from "node-telegram-bot-api";
import CallOfDutyApi from "call-of-duty-api";
import { format } from "@fast-csv/format";
import { stringify } from "querystring";

const API = CallOfDutyApi({
  ratelimit: { maxRequests: 2, perMilliseconds: 1000, maxRPS: 2 },
});

type HandlerRespType = "text" | "file";

type HandlerResp = {
  resp: string;
  type: HandlerRespType;
  fileName?: string;
  contentType?: string;
};

type Handler = (msg: TelegramBot.Message) => Promise<HandlerResp>;

type UserInfoAll = {
  username: string;
  gamesPlayed: string;
  wins: string;
  kills: string;
  deaths: string;
  downs: string;
  kdRatio: string;
  topFive: string;
  topTen: string;
  topTwentyFive: string;
  accuracy: string;
};

type UserInfoLastWeek = {
  kills: string;
  deaths: string;
  kdRatio: string;
  gulagDeaths: string;
  gulagKills: string;
  objectiveTeamWiped: string;
  headshots: string;
  headshotPercentage: string;
  killsPerGame: string;
  damageDone: string;
  damageTaken: string;
};

type UserInfo = {
  all: UserInfoAll;
  lastWeek: UserInfoLastWeek;
};

const router = new Map<string, Handler>([
  ["user", UserInfoHandler],
  ["userRaw", UserInfoRawHandler],
  ["userCompare", UserInfoCompareHandler],
]);

// command text format: /cmd arg1 arg2 ...
export function getHandler(message: TelegramBot.Message): Handler {
  const text = message.text;
  if (!text) {
    return unknownCommand;
  }
  let command = getCommand(text);
  if (!command.startsWith("/")) {
    return emptyHandler;
  }
  command = command.substring(1);
  if (!router.has(command)) {
    return unknownCommand;
  }
  return router.get(command)!;
}

export async function login(email: string, password: string) {
  await API.login(email, password);
}

function getCommand(text: string | undefined): string {
  if (!text) return "";
  return text.split(" ")[0];
}

function getArgs(text: string | undefined): string[] {
  if (!text) return [];
  return text.split(" ").slice(1);
}

function getPlatform(p: string) {
  switch (p) {
    case "battle":
      return API.platforms.battle;
    case "psn":
      return API.platforms.psn;
    case "xbl":
      return API.platforms.xbl;
    default:
      return API.platforms.all;
  }
}

function getUserInfoFromData(data: any): UserInfo {
  return {
    all: {
      username: data.username,
      gamesPlayed: data.lifetime.mode.br.properties.gamesPlayed,
      wins: data.lifetime.mode.br.properties.wins,
      kills: data.lifetime.mode.br.properties.kills,
      deaths: data.lifetime.mode.br.properties.deaths,
      downs: data.lifetime.mode.br.properties.downs,
      kdRatio: data.lifetime.mode.br.properties.kdRatio,
      topFive: data.lifetime.mode.br.properties.topFive,
      topTen: data.lifetime.mode.br.properties.topTen,
      topTwentyFive: data.lifetime.mode.br.properties.topTwentyFive,
      accuracy: data.lifetime.all.properties.accuracy,
    },
    lastWeek: {
      kills: data.weekly.mode.br_all.properties.kills,
      deaths: data.weekly.mode.br_all.properties.deaths,
      kdRatio: data.weekly.mode.br_all.properties.kdRatio,
      gulagDeaths: data.weekly.mode.br_all.properties.gulagDeaths,
      gulagKills: data.weekly.mode.br_all.properties.gulagKills,
      objectiveTeamWiped: data.weekly.mode.br_all.properties.objectiveTeamWiped,
      headshots: data.weekly.mode.br_all.properties.headshots,
      headshotPercentage: data.weekly.mode.br_all.properties.headshotPercentage,
      killsPerGame: data.weekly.mode.br_all.properties.killsPerGame,
      damageDone: data.weekly.mode.br_all.properties.damageDone,
      damageTaken: data.weekly.mode.br_all.properties.damageTaken,
    },
  };
}

function userInfoKeyToName(key: string): string | undefined {
  const m = new Map<string, string>([
    ["username", "User"],
    ["gamesPlayed", "Game played"],
    ["wins", "Wins"],
    ["kills", "Kills"],
    ["deaths", "Deaths"],
    ["downs", "Downs"],
    ["kdRatio", "K/D"],
    ["topFive", "Top 5"],
    ["topTen", "Top 10"],
    ["topTwentyFive", "Top 25"],
    ["accuracy", "Accuracy (MP and WZ)"],
    ["gulagDeaths", "Gulag deaths"],
    ["gulagKills", "Gulag kills"],
    ["objectiveTeamWiped", "Team wiped"],
    ["headshots", "Headshots"],
    ["headshotPercentage", "Headshot percentage"],
    ["killsPerGame", "Kills per game"],
    ["damageDone", "Damage done"],
    ["damageTaken", "Damage taken"],
  ]);
  return m.get(key);
}

function constructUserInfo(data: any) {
  const info = getUserInfoFromData(data);
  return `\`\`\`
---
ALL
---
${Object.entries(info.all)
  .map((entry: string[]) => userInfoKeyToName(entry[0]) + ": " + entry[1])
  .join("\n")}
---
Last week
---
${Object.entries(info.lastWeek)
  .map((entry: string[]) => userInfoKeyToName(entry[0]) + ": " + entry[1])
  .join("\n")}
\`\`\`
`;
}

async function UserInfoHandler(
  message: TelegramBot.Message
): Promise<HandlerResp> {
  const args = getArgs(message.text);
  if (args.length !== 2) {
    return {
      resp: `Error: invalid arguments: ${args}`,
      type: "text",
    };
  }
  const [platform, user] = args;
  const data = await API.MWwzstats(user, getPlatform(platform));
  return {
    resp: constructUserInfo(data),
    type: "text",
  };
}

async function UserInfoRawHandler(
  message: TelegramBot.Message
): Promise<HandlerResp> {
  const args = getArgs(message.text);
  if (args.length !== 2) {
    return {
      resp: `Error: invalid arguments\\. Should be /user platform username`,
      type: "text",
    };
  }
  const [platform, user] = args;
  const data = await API.MWwzstats(user, getPlatform(platform));
  return {
    resp: JSON.stringify(data, null, 2),
    type: "file",
    fileName: "userData.json",
    contentType: "text/json",
  };
}

async function UserInfoCompareHandler(
  message: TelegramBot.Message
): Promise<HandlerResp> {
  const args = getArgs(message.text);
  if (args.length < 2 || args.length % 2 !== 0) {
    return {
      resp: `Error: invalid arguments\\. Should be /user platform1 username1 platform2 username2\\.\\.\\.`,
      type: "text",
    };
  }
  const infos = new Array<UserInfo>();
  for (let i = 0; i < args.length; i += 2) {
    const platform = args[i];
    const user = args[i + 1];
    const data = await API.MWwzstats(user, getPlatform(platform));
    infos.push(getUserInfoFromData(data));
  }

  // write to a csv file
  const csvStream = format({ headers: false });
  csvStream.write([""].concat(infos.map((item) => item.all.username)));

  Object.keys(infos[0].all)
    .map((key) => {
      const row = [`ALL: ${userInfoKeyToName(key)}`];
      return row.concat(
        infos.map((info) => {
          return String((info.all as any)[key]);
        })
      );
    })
    .forEach((row) => csvStream.write(row));

  Object.keys(infos[0].lastWeek)
    .map((key) => {
      const row = [`LastWeek: ${userInfoKeyToName(key)}`];
      return row.concat(
        infos.map((info) => {
          return String((info.lastWeek as any)[key]);
        })
      );
    })
    .forEach((row) => csvStream.write(row));
  csvStream.end();

  return {
    resp: csvStream.read().toString(),
    type: "file",
    fileName: "userCompare.csv",
    contentType: "text/csv",
  };
}

async function unknownCommand(
  message: TelegramBot.Message
): Promise<HandlerResp> {
  const command = getCommand(message.text!);
  return {
    resp: `unknown command: ${command}`,
    type: "text",
  };
}

async function emptyHandler(): Promise<HandlerResp> {
  return {
    resp: "",
    type: "text",
  };
}
