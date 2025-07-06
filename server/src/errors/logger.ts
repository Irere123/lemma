import pino from "pino";

export const initLogger = () => {
  // create separate streams for console and HyperDX
  const streams: pino.StreamEntry[] = [];

  if (process.env.NODE_ENV === "development") {
    streams.push({
      level: "info",
      stream: pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "UTC:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname,res,statusCode,worker,context,req",
          customColors: {
            default: "white",
            60: "bgRed",
            50: "red",
            40: "yellow",
            30: "green",
            20: "blue",
            10: "gray",
            message: "reset",
            greyMessage: "gray",
            time: "darkGray",
          },
        },
      }),
    });
  }

  if (process.env.AXIOM_TOKEN) {
    streams.push({
      level: "info",
      stream: pino.transport({
        target: "@axiomhq/pino",
        options: {
          token: process.env.AXIOM_TOKEN,
          dataset: "express",
        },
      }),
    });
  }

  const logger = pino.default(
    {
      level: process.env.NODE_ENV === "development" ? "debug" : "info",
      formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
      },
    },
    // use multistream to send logs to multiple destinations
    pino.multistream(streams)
  );

  return logger;
};
