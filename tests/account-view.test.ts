import { describe, expect, it } from "vitest";
import { addressLines, newestFirst, orderDateLabel, phoneLabel, profileForSave, profileIsFilled, profileProblem } from "../src/lib/account-view";

const address = { id: "a", addressLine: " Av. Sol 123 ", district: "Miraflores", province: "Lima", department: "Lima", city: "Miraflores", reference: "Frente al parque" };

describe("account view", () => {
  it("shows the summary only when name and a valid phone are saved", () => {
    expect(profileIsFilled({ name: "Ana", phone: "987654321", email: "", addresses: [] })).toBe(true);
    expect(profileIsFilled({ name: "", phone: "987654321", email: "", addresses: [] })).toBe(false);
    expect(profileIsFilled({ name: "Ana", phone: "", email: "", addresses: [] })).toBe(false);
    expect(profileIsFilled(null)).toBe(false);
  });

  it("summarises the address without repeating Lima", () => {
    expect(addressLines(address)).toEqual(["Av. Sol 123", "Miraflores, Lima", "Referencia: Frente al parque"]);
    expect(addressLines({ ...address, addressLine: "" })).toEqual([]);
    expect(addressLines(undefined)).toEqual([]);
  });

  it("formats the phone and validates before saving", () => {
    expect(phoneLabel("51987654321")).toBe("987 654 321");
    expect(phoneLabel("abc")).toBe("abc");
    expect(profileProblem({ name: " ", phone: "", email: "", addresses: [] }, "987654321")).toBe("Escribe tu nombre.");
    expect(profileProblem({ name: "Ana", phone: "", email: "", addresses: [] }, "123")).toBe("Ingresa un celular peruano de 9 dígitos.");
    expect(profileProblem({ name: "Ana", phone: "", email: "", addresses: [] }, "987 654 321")).toBeNull();
  });

  it("does not send empty address rows", () => {
    const empty = profileForSave({ name: " Ana ", phone: "", email: " a@b.pe ", addresses: [{ ...address, addressLine: "  " }] }, "987654321");
    expect(empty.addresses).toEqual([]);
    expect(empty.name).toBe("Ana");
    expect(profileForSave({ name: "Ana", phone: "", email: "", addresses: [address] }, "987654321").addresses[0].addressLine).toBe("Av. Sol 123");
  });

  it("dates orders in Lima time and sorts newest first", () => {
    expect(orderDateLabel("2026-11-26T03:30:00.000Z")).toBe("25 nov 2026");
    expect(orderDateLabel("2026-11-26T12:00:00.000Z")).toBe("26 nov 2026");
    expect(orderDateLabel("")).toBe("");
    expect(newestFirst([{ createdAt: "2026-01-01" }, { createdAt: "2026-02-01" }]).map((o) => o.createdAt)).toEqual(["2026-02-01", "2026-01-01"]);
  });
});
