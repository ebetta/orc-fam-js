import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Tag as TagIcon, ChevronDown, ChevronUp } from "lucide-react";

export default function TagsHeader({ onAddTag, tagsCount, onExpandAll, onCollapseAll }) {
  return (
    <Card className="bg-gradient-to-r from-purple-500 to-purple-700 border-0 shadow-xl">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="text-white">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <TagIcon className="w-8 h-8" />
              Gerenciar Tags
            </h1>
            <p className="text-purple-100 text-lg">
              Organize suas transações com tags personalizadas e hierárquicas
            </p>
            <p className="text-purple-200 text-sm mt-1">
              {tagsCount} tag{tagsCount !== 1 ? 's' : ''} cadastrada{tagsCount !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2">
              <Button 
                onClick={onExpandAll}
                variant="outline"
                size="sm"
                className="bg-white bg-opacity-20 text-white border-white border-opacity-30 hover:bg-white hover:bg-opacity-30 hover:text-white"
              >
                <ChevronDown className="w-4 h-4 mr-2" />
                Expandir Todos
              </Button>
              <Button 
                onClick={onCollapseAll}
                variant="outline"
                size="sm"
                className="bg-white bg-opacity-20 text-white border-white border-opacity-30 hover:bg-white hover:bg-opacity-30 hover:text-white"
              >
                <ChevronUp className="w-4 h-4 mr-2" />
                Colapsar Todos
              </Button>
            </div>
            <Button 
              onClick={onAddTag}
              size="lg" 
              className="bg-white text-purple-700 hover:bg-purple-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nova Tag
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}