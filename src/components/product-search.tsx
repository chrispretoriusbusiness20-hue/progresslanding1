import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./ui/command";
import { decodeProductName } from "@/lib/product-display";

export function ProductSearch({
  names,
  value,
  onChange,
}: {
  names: string[];
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Estimator product"
          aria-expanded={open}
          className="h-auto min-h-12 w-full justify-between whitespace-normal rounded-none border-2 border-foreground text-left"
        >
          <span className="min-w-0 break-words">
            {decodeProductName(value) || "Choose a product"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-48px)] p-0">
        <Command>
          <CommandInput placeholder="Search products…" />
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            {names.map((name) => (
              <CommandItem
                key={name}
                value={decodeProductName(name)}
                onSelect={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className="min-h-11 whitespace-normal"
              >
                {decodeProductName(name)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
