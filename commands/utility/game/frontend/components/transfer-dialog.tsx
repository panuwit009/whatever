"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function TransferDialog() {
  const [account, setAccount] = useState("")
  const [amount, setAmount] = useState("")

  function handleTransfer() {
    const value = Number(amount)

    if (!account.trim()) {
      alert("กรุณากรอกบัญชีปลายทาง")
      return
    }

    if (!Number.isFinite(value) || value <= 0) {
      alert("กรุณากรอกจำนวนเงินให้ถูกต้อง")
      return
    }

    // TODO: เรียก API โอนเงิน
    console.log("Transfer:", {
      account,
      amount: value,
    })
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button className="flex-1 bg-blue-600 text-white hover:bg-blue-700">
            โอนเงิน
          </Button>
        }
      />

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>โอนเงิน</DialogTitle>
          <DialogDescription>
            ระบุบัญชีปลายทางและจำนวนเงินที่ต้องการโอน
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="transfer-account">
              บัญชีปลายทาง
            </Label>
            <Input
              id="transfer-account"
              placeholder="กรอกเลขบัญชีปลายทาง"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="transfer-amount">
              จำนวนเงิน (บาท)
            </Label>
            <Input
              id="transfer-amount"
              type="number"
              min="1"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline">ยกเลิก</Button>
            }
          />
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleTransfer}
          >
            ยืนยันโอนเงิน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}