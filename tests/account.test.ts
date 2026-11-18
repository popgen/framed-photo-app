import { describe, expect, it } from "vitest";
import { createLocalRepo } from "../src/lib/repo-local";

describe("customer account scope", () => {
  it("returns only the orders for that phone", async () => {
    const repo = createLocalRepo();
    await repo.init();
    const example = await repo.listOrdersByPhone("987 654 321");
    const cusco = await repo.listOrdersByPhone("922 222 222");
    const other = await repo.listOrdersByPhone("933 333 333");
    expect(example).toEqual([]);
    expect(cusco.map((order) => order.number)).toEqual(["MF-26-1002"]);
    expect(other.map((order) => order.number)).toEqual(["MF-26-1003"]);
    expect(cusco.some((order) => other.some((row) => row.publicToken === order.publicToken))).toBe(false);
  });
});
