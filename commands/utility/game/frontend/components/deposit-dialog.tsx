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

export function DepositDialog() {
  const [amount, setAmount] = useState("")

  function handleDeposit() {
    const value = Number(amount)

    if (!Number.isFinite(value) || value <= 0) {
      alert("กรุณากรอกจำนวนเงินให้ถูกต้อง")
      return
    }

    // TODO: เรียก API ฝากเงิน
    console.log("Deposit:", value)
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button className="flex-1 bg-green-600 text-white hover:bg-green-700">
            ฝากเงิน
          </Button>
        }
      />

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ฝากเงิน</DialogTitle>
          <DialogDescription>
            ระบุจำนวนเงินที่ต้องการฝาก
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="deposit-amount">
            จำนวนเงิน (บาท)
          </Label>
          <Input
            id="deposit-amount"
            type="number"
            min="1"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline">ยกเลิก</Button>
            }
          />
          <Button
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={handleDeposit}
          >
            ยืนยันฝากเงิน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}