"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface User {
  cid: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN" | "MAIN_ADMIN";
}

export default function AdminTeamPage() {
  const [admins, setAdmins] = useState<User[]>([]);
  const [cid, setCid] = useState("");

  const loadAdmins = async () => {
    const res = await fetch("/api/admin/team");
    const data = await res.json();
    setAdmins(data);
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const addAdmin = async () => {
    if (!cid.trim()) return;
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid: cid.trim() }),
    });
    setCid("");
    loadAdmins();
    console.log(res);
  };

  const removeAdmin = async (id: string) => {
    const res = await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
    loadAdmins();
    console.log(res);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Team</h1>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Enter CID"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
        />
        <Button onClick={addAdmin}>Add User to Team</Button>
      </div>

      <div className="grid gap-4">
        {admins.map((user) => (
          <Card key={user.cid}>
            <CardHeader>
              <CardTitle>
                {user.name}{" "}
                {user.role === "MAIN_ADMIN" && (
                  <span className="text-red-500 text-sm ml-2">(Main Admin)</span>
                )}
              </CardTitle>
              <p className="text-sm text-gray-500">{user.email}</p>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              <span>Role: {user.role}</span>
              
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeAdmin(user.cid)}
                >
                  Remove
                </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
