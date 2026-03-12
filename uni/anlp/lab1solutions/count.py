# -*- coding: utf-8 -*-
import sys

def count_characters(text):
  #if text is a string then len returns the number of characters in a string
    return len(text)


def count_lines(lines):
  #if lines is a list of lines read using readlines then len will return the number of lines
  return len(lines)

def count_words(text):
  #assume that words are delimited by whitespace
  #of course we could use the nltk tokenise function, which will handle punctuation much better!
  words =text.split()
  return len(words)

def find_frequencies(lines):
  letter_frequencies={}
  for line in mytext:
    for char in line.lower():
    #for every character that I encounter, look up how many times I have seen it previously, add 1 and store.
    
      letter_frequencies[char]=letter_frequencies.get(char,0)+1
  ranked_list=sorted(letter_frequencies.items(),key=lambda x:x[1],reverse=True)
  print(ranked_list)
  return ranked_list


if __name__ == "__main__":
  #filename="text.txt"

  filename=sys.argv[1]

  print(f'Name of file is: {filename}')

  with open(filename) as instream:
      mytext=instream.readlines()

  print(f'The number of lines in {filename} is {count_lines(mytext)}')
  lengths=[count_words(line) for line in mytext]
  print(f'The number of words is {filename} is {sum(lengths)}')

  ranked_list=find_frequencies(mytext)
  print(f'The most frequently occurring letter is {ranked_list[0][0]} which occurs {ranked_list[0][1]} times')

