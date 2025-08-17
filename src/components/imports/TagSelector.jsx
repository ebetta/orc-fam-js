import React, { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

export default function TagSelector({ tags, selectedTagId, onTagChange }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const selectedTag = tags.find(t => t.id === selectedTagId);

  useEffect(() => {
    if (selectedTag) {
      setSearchValue(selectedTag.name);
    } else {
      setSearchValue("");
    }
  }, [selectedTag]);

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={popoverOpen}
          className="w-full justify-between h-10 font-normal text-xs"
        >
          {selectedTag ? selectedTag.name : "Selecionar tag..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder="Buscar tag..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                key="no-tag"
                value=""
                onSelect={() => {
                  onTagChange(null);
                  setSearchValue("");
                  setPopoverOpen(false);
                }}
              >
                <Check
                  className={`mr-2 h-4 w-4 ${!selectedTagId ? "opacity-100" : "opacity-0"}`}
                />
                Nenhuma tag
              </CommandItem>
              {filteredTags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.name}
                  onSelect={(currentValue) => {
                    const selected = tags.find(t => t.name.toLowerCase() === currentValue.toLowerCase());
                    onTagChange(selected ? selected.id : null);
                    setSearchValue(selected ? selected.name : "");
                    setPopoverOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${selectedTagId === tag.id ? "opacity-100" : "opacity-0"}`}
                  />
                  {tag.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
