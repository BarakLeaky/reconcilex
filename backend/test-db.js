const { Client } = require("pg");

const client = new Client({
  host: "127.0.0.1",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "reconcilex",
});

async function test() {
  try {
    await client.connect();

    const result = await client.query(
      "SELECT current_user, current_database(), inet_client_addr()"
    );

    console.log("DATABASE CONNECTION SUCCESS:");
    console.log(result.rows);
  } catch (error) {
    console.error("DATABASE TEST FAILED:");
    console.error(error);
  } finally {
    await client.end().catch(() => {});
  }
}

test();